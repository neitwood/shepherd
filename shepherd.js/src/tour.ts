import { Evented } from './evented';
import { Step, type StepOptions } from './step';
import autoBind from './utils/auto-bind';
import {
  isHTMLElement,
  isFunction,
  isString,
  isUndefined
} from './utils/type-check';
import { cleanupSteps } from './utils/cleanup';
import DataRequest from './utils/datarequest';
import { normalizePrefix, uuid } from './utils/general';
// @ts-expect-error TODO: not yet typed
import ShepherdModal from './components/shepherd-modal.svelte';
import type { NoOp } from './utils/general';

interface Actor {
  actorId: number;
}

interface EventOptions {
  previous?: Step | null;
  step?: Step | null;
  tour: Tour;
}

/**
 * The options for the tour
 */
export interface TourOptions {
  /**
   * If true, will issue a `window.confirm` before cancelling.
   * If it is a function(support Async Function), it will be called and wait for the return value,
   * and will only be cancelled if the value returned is true.
   */
  confirmCancel?:
    | boolean
    | (() => boolean)
    | Promise<boolean>
    | (() => Promise<boolean>);
  /**
   * The message to display in the `window.confirm` dialog.
   */
  confirmCancelMessage?: string;
  /**
   * The prefix to add to the `shepherd-enabled` and `shepherd-target` class names as well as the `data-shepherd-step-id`.
   */
  classPrefix?: string;
  /**
   * Default options for Steps ({@link Step#constructor}), created through `addStep`.
   */
  defaultStepOptions?: StepOptions;
  /**
   * Exiting the tour with the escape key will be enabled unless this is explicitly
   * set to false.
   */
  exitOnEsc?: boolean;
  /**
   * Navigating the tour via left and right arrow keys will be enabled
   * unless this is explicitly set to false.
   */
  keyboardNavigation?: boolean;
  /**
   * An optional container element for the modal.
   * If not set, the modal will be appended to `document.body`.
   */
  modalContainer?: HTMLElement;
  /**
   * An optional container element for the steps.
   * If not set, the steps will be appended to `document.body`.
   */
  stepsContainer?: HTMLElement;
  /**
   * An array of step options objects or Step instances to initialize the tour with.
   */
  steps?: Array<StepOptions> | Array<Step>;
  /**
   * An optional "name" for the tour. This will be appended to the the tour's
   * dynamically generated `id` property.
   */
  tourName?: string;
  /**
   * Whether or not steps should be placed above a darkened
   * modal overlay. If true, the overlay will create an opening around the target element so that it
   * can remain interactive
   */
  useModalOverlay?: boolean;
}

const SHEPHERD_DEFAULT_API = 'https://shepherdpro.com' as const;
const SHEPHERD_USER_ID = 'shepherdPro:userId' as const;

export class ShepherdPro extends Evented {
  activeTour?: Tour | null;
  apiKey?: string;
  apiPath?: string;
  dataRequester?: DataRequest;
  declare Step: NoOp | Step;
  declare Tour: NoOp | Tour;

  init(apiKey?: string, apiPath?: string) {
    if (!apiKey) {
      throw new Error('Shepherd Pro: Missing required apiKey option.');
    }
    this.apiKey = apiKey;
    this.apiPath = apiPath ?? SHEPHERD_DEFAULT_API;

    if (this.apiKey) {
      this.dataRequester = new DataRequest(this.apiKey, this.apiPath);
      // Setup actor before first tour is loaded if none exists
      const shepherdProId = localStorage.getItem(SHEPHERD_USER_ID);

      if (!shepherdProId) {
        this.createNewActor();
      }
    }
  }

  async createNewActor() {
    if (!this.dataRequester) return;

    // Setup type returns an actor
    const response = (await this.dataRequester.sendEvents({
      data: {
        currentUserId: null,
        eventType: 'setup'
      }
    })) as unknown as Actor;

    localStorage.setItem(SHEPHERD_USER_ID, String(response.actorId));
  }
}

/**
 * Class representing the site tour
 * @extends {Evented}
 */
export class Tour extends Evented {
  dataRequester;
  trackedEvents = ['active', 'cancel', 'complete', 'show'];

  private currentUserId: string | null = null;

  classPrefix: string;
  currentStep?: Step | null;
  focusedElBeforeOpen?: HTMLElement | null;
  id?: string;
  modal?: ShepherdModal;
  options: TourOptions;
  steps: Array<Step>;

  constructor(options: TourOptions = {}) {
    super();

    autoBind(this);

    const defaultTourOptions = {
      exitOnEsc: true,
      keyboardNavigation: true
    };

    this.options = Object.assign({}, defaultTourOptions, options);
    this.classPrefix = normalizePrefix(this.options.classPrefix);
    this.steps = [];
    this.addSteps(this.options.steps);

    // Pass these events onto the global Shepherd object
    const events = [
      'active',
      'cancel',
      'complete',
      'inactive',
      'show',
      'start'
    ];
    events.map((event) => {
      ((e) => {
        this.on(e, (opts?: { [key: string]: unknown }) => {
          opts = opts || {};
          opts['tour'] = this;
          Shepherd.trigger(e, opts);
        });
      })(event);
    });

    this._setTourID();

    const { apiKey, apiPath } = Shepherd;
    // If we have an API key, then setup Pro features
    if (apiKey && apiPath) {
      this.dataRequester = new DataRequest(apiKey, apiPath);

      const shepherdProId = localStorage.getItem('shepherdPro:userId');
      this.currentUserId = shepherdProId;

      this.trackedEvents.forEach((event) =>
        this.on(event, (opts: EventOptions) => {
          const { tour } = opts;
          const { id, steps } = tour;
          let position;

          if (event !== 'active') {
            const { step: currentStep } = opts;

            if (currentStep) {
              position =
                steps.findIndex((step) => step.id === currentStep.id) + 1;
            }
          }

          const data = {
            currentUserId: this.currentUserId,
            eventType: event,
            journeyData: {
              id,
              currentStep: position,
              numberOfSteps: steps.length,
              steps,
              tourOptions: tour.options
            }
          };
          this.dataRequester?.sendEvents({ data });
        })
      );
    }

    return this;
  }

  /**
   * Adds a new step to the tour
   * @param options - An object containing step options or a Step instance
   * @param index - The optional index to insert the step at. If undefined, the step
   * is added to the end of the array.
   * @return The newly added step
   */
  addStep(options: StepOptions | Step, index?: number) {
    let step = options;

    if (!(step instanceof Step)) {
      step = new Step(this, step);
    } else {
      step.tour = this;
    }

    if (!isUndefined(index)) {
      this.steps.splice(index, 0, step as Step);
    } else {
      this.steps.push(step as Step);
    }

    return step;
  }

  /**
   * Add multiple steps to the tour
   * @param steps - The steps to add to the tour
   */
  addSteps(steps?: Array<StepOptions> | Array<Step>) {
    if (Array.isArray(steps)) {
      steps.forEach((step) => {
        this.addStep(step);
      });
    }

    return this;
  }

  /**
   * Go to the previous step in the tour
   */
  back() {
    const index = this.steps.indexOf(this.currentStep as Step);
    this.show(index - 1, false);
  }

  /**
   * Calls _done() triggering the 'cancel' event
   * If `confirmCancel` is true, will show a window.confirm before cancelling
   * If `confirmCancel` is a function, will call it and wait for the return value,
   * and only cancel when the value returned is true
   */
  async cancel() {
    if (this.options.confirmCancel) {
      const cancelMessage =
        this.options.confirmCancelMessage ||
        'Are you sure you want to stop the tour?';
      let stopTour;

      if (isFunction(this.options.confirmCancel)) {
        stopTour = await this.options.confirmCancel();
      } else {
        stopTour = window.confirm(cancelMessage);
      }

      if (stopTour) {
        this._done('cancel');
      }
    } else {
      this._done('cancel');
    }
  }

  /**
   * Calls _done() triggering the `complete` event
   */
  complete() {
    this._done('complete');
  }

  /**
   * Gets the step from a given id
   * @param id - The id of the step to retrieve
   * @return The step corresponding to the `id`
   */
  getById(id: number | string) {
    return this.steps.find((step) => {
      return step.id === id;
    });
  }

  /**
   * Gets the current step
   */
  getCurrentStep() {
    return this.currentStep;
  }

  /**
   * Hide the current step
   */
  hide() {
    const currentStep = this.getCurrentStep();

    if (currentStep) {
      return currentStep.hide();
    }
  }

  /**
   * Check if the tour is active
   */
  isActive() {
    return Shepherd.activeTour === this;
  }

  /**
   * Go to the next step in the tour
   * If we are at the end, call `complete`
   */
  next() {
    const index = this.steps.indexOf(this.currentStep as Step);

    if (index === this.steps.length - 1) {
      this.complete();
    } else {
      this.show(index + 1, true);
    }
  }

  /**
   * Removes the step from the tour
   * @param name - The id for the step to remove
   */
  removeStep(name: string) {
    const current = this.getCurrentStep();

    // Find the step, destroy it and remove it from this.steps
    this.steps.some((step, i) => {
      if (step.id === name) {
        if (step.isOpen()) {
          step.hide();
        }

        step.destroy();
        this.steps.splice(i, 1);

        return true;
      }
    });

    if (current && current.id === name) {
      this.currentStep = undefined;

      // If we have steps left, show the first one, otherwise just cancel the tour
      this.steps.length ? this.show(0) : this.cancel();
    }
  }

  /**
   * Show a specific step in the tour
   * @param key - The key to look up the step by
   * @param forward - True if we are going forward, false if backward
   */
  show(key: number | string = 0, forward = true) {
    const step = isString(key) ? this.getById(key) : this.steps[key];

    if (step) {
      this._updateStateBeforeShow();

      const shouldSkipStep =
        isFunction(step.options.showOn) && !step.options.showOn();

      // If `showOn` returns false, we want to skip the step, otherwise, show the step like normal
      if (shouldSkipStep) {
        this._skipStep(step, forward);
      } else {
        this.trigger('show', {
          step,
          previous: this.currentStep
        });

        this.currentStep = step;
        step.show();
      }
    }
  }

  /**
   * Start the tour
   */
  start() {
    this.trigger('start');

    // Save the focused element before the tour opens
    this.focusedElBeforeOpen = document.activeElement as HTMLElement | null;

    this.currentStep = null;

    this.setupModal();

    this._setupActiveTour();
    this.next();
  }

  /**
   * Called whenever the tour is cancelled or completed, basically anytime we exit the tour
   * @param event The event name to trigger
   * @private
   */
  _done(event: string) {
    const index = this.steps.indexOf(this.currentStep as Step);
    if (Array.isArray(this.steps)) {
      this.steps.forEach((step) => step.destroy());
    }

    cleanupSteps(this);

    this.trigger(event, { index });

    Shepherd.activeTour = null;
    this.trigger('inactive', { tour: this });

    if (this.modal) {
      this.modal.hide();
    }

    if (event === 'cancel' || event === 'complete') {
      if (this.modal) {
        const modalContainer = document.querySelector(
          '.shepherd-modal-overlay-container'
        );

        if (modalContainer) {
          modalContainer.remove();
        }
      }
    }

    // Focus the element that was focused before the tour started
    if (isHTMLElement(this.focusedElBeforeOpen)) {
      this.focusedElBeforeOpen.focus();
    }
  }

  /**
   * Make this tour "active"
   */
  _setupActiveTour() {
    this.trigger('active', { tour: this });

    Shepherd.activeTour = this;
  }

  /**
   * setupModal create the modal container and instance
   */
  setupModal() {
    this.modal = new ShepherdModal({
      target: this.options.modalContainer || document.body,
      props: {
        // @ts-expect-error TODO: investigate where styles comes from
        styles: this.styles
      }
    });
  }

  /**
   * Called when `showOn` evaluates to false, to skip the step or complete the tour if it's the last step
   * @param step - The step to skip
   * @param forward - True if we are going forward, false if backward
   * @private
   */
  _skipStep(step: Step, forward: boolean) {
    const index = this.steps.indexOf(step);

    if (index === this.steps.length - 1) {
      this.complete();
    } else {
      const nextIndex = forward ? index + 1 : index - 1;
      this.show(nextIndex, forward);
    }
  }

  /**
   * Before showing, hide the current step and if the tour is not
   * already active, call `this._setupActiveTour`.
   * @private
   */
  _updateStateBeforeShow() {
    if (this.currentStep) {
      this.currentStep.hide();
    }

    if (!this.isActive()) {
      this._setupActiveTour();
    }
  }

  /**
   * Sets this.id to `${tourName}--${uuid}`
   * @private
   */
  _setTourID() {
    const tourName = this.options.tourName || 'tour';

    this.id = `${tourName}--${uuid()}`;
  }
}

const Shepherd = new ShepherdPro();

export { Shepherd };
