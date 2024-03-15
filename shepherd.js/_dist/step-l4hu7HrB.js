/*! shepherd.js 12.0.0-alpha.3 */

import { d as destroyTooltip, a as deepmerge, m as mergeTooltipConfig, s as setupTooltip } from './floating-ui-CG42dGZ2.js';
import { Evented } from './evented.js';
import autoBind from './utils/auto-bind.js';
import { isFunction, isHTMLElement, isUndefined, isString, isElement } from './utils/type-check.js';
import { bindAdvance } from './utils/bind.js';
import { normalizePrefix, parseAttachTo, uuid } from './utils/general.js';

function noop() {}
function assign(tar, src) {
  // @ts-ignore
  for (const k in src) tar[k] = src[k];
  return tar;
}
function run(fn) {
  return fn();
}
function blank_object() {
  return Object.create(null);
}
function run_all(fns) {
  fns.forEach(run);
}
function is_function(thing) {
  return typeof thing === 'function';
}
function safe_not_equal(a, b) {
  return a != a ? b == b : a !== b || a && typeof a === 'object' || typeof a === 'function';
}
function is_empty(obj) {
  return Object.keys(obj).length === 0;
}
function append(target, node) {
  target.appendChild(node);
}
function insert(target, node, anchor) {
  target.insertBefore(node, anchor || null);
}
function detach(node) {
  if (node.parentNode) {
    node.parentNode.removeChild(node);
  }
}
function destroy_each(iterations, detaching) {
  for (let i = 0; i < iterations.length; i += 1) {
    if (iterations[i]) iterations[i].d(detaching);
  }
}
function element(name) {
  return document.createElement(name);
}
function svg_element(name) {
  return document.createElementNS('http://www.w3.org/2000/svg', name);
}
function text(data) {
  return document.createTextNode(data);
}
function space() {
  return text(' ');
}
function empty() {
  return text('');
}
function listen(node, event, handler, options) {
  node.addEventListener(event, handler, options);
  return () => node.removeEventListener(event, handler, options);
}
function attr(node, attribute, value) {
  if (value == null) node.removeAttribute(attribute);else if (node.getAttribute(attribute) !== value) node.setAttribute(attribute, value);
}
/**
 * List of attributes that should always be set through the attr method,
 * because updating them through the property setter doesn't work reliably.
 * In the example of `width`/`height`, the problem is that the setter only
 * accepts numeric values, but the attribute can also be set to a string like `50%`.
 * If this list becomes too big, rethink this approach.
 */
const always_set_through_set_attribute = ['width', 'height'];
function set_attributes(node, attributes) {
  // @ts-ignore
  const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
  for (const key in attributes) {
    if (attributes[key] == null) {
      node.removeAttribute(key);
    } else if (key === 'style') {
      node.style.cssText = attributes[key];
    } else if (key === '__value') {
      node.value = node[key] = attributes[key];
    } else if (descriptors[key] && descriptors[key].set && always_set_through_set_attribute.indexOf(key) === -1) {
      node[key] = attributes[key];
    } else {
      attr(node, key, attributes[key]);
    }
  }
}
function children(element) {
  return Array.from(element.childNodes);
}
function toggle_class(element, name, toggle) {
  element.classList[toggle ? 'add' : 'remove'](name);
}
let current_component;
function set_current_component(component) {
  current_component = component;
}
function get_current_component() {
  if (!current_component) throw new Error('Function called outside component initialization');
  return current_component;
}
/**
 * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
 * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
 * it can be called from an external module).
 *
 * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
 *
 * https://svelte.dev/docs#run-time-svelte-onmount
 */
function onMount(fn) {
  get_current_component().$$.on_mount.push(fn);
}
/**
 * Schedules a callback to run immediately after the component has been updated.
 *
 * The first time the callback runs will be after the initial `onMount`
 */
function afterUpdate(fn) {
  get_current_component().$$.after_update.push(fn);
}
const dirty_components = [];
const binding_callbacks = [];
let render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = /* @__PURE__ */Promise.resolve();
let update_scheduled = false;
function schedule_update() {
  if (!update_scheduled) {
    update_scheduled = true;
    resolved_promise.then(flush);
  }
}
function add_render_callback(fn) {
  render_callbacks.push(fn);
}
// flush() calls callbacks in this order:
// 1. All beforeUpdate callbacks, in order: parents before children
// 2. All bind:this callbacks, in reverse order: children before parents.
// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
//    for afterUpdates called during the initial onMount, which are called in
//    reverse order: children before parents.
// Since callbacks might update component values, which could trigger another
// call to flush(), the following steps guard against this:
// 1. During beforeUpdate, any updated components will be added to the
//    dirty_components array and will cause a reentrant call to flush(). Because
//    the flush index is kept outside the function, the reentrant call will pick
//    up where the earlier call left off and go through all dirty components. The
//    current_component value is saved and restored so that the reentrant call will
//    not interfere with the "parent" flush() call.
// 2. bind:this callbacks cannot trigger new flush() calls.
// 3. During afterUpdate, any updated components will NOT have their afterUpdate
//    callback called a second time; the seen_callbacks set, outside the flush()
//    function, guarantees this behavior.
const seen_callbacks = new Set();
let flushidx = 0; // Do *not* move this inside the flush() function
function flush() {
  // Do not reenter flush while dirty components are updated, as this can
  // result in an infinite loop. Instead, let the inner flush handle it.
  // Reentrancy is ok afterwards for bindings etc.
  if (flushidx !== 0) {
    return;
  }
  const saved_component = current_component;
  do {
    // first, call beforeUpdate functions
    // and update components
    try {
      while (flushidx < dirty_components.length) {
        const component = dirty_components[flushidx];
        flushidx++;
        set_current_component(component);
        update(component.$$);
      }
    } catch (e) {
      // reset dirty state to not end up in a deadlocked state and then rethrow
      dirty_components.length = 0;
      flushidx = 0;
      throw e;
    }
    set_current_component(null);
    dirty_components.length = 0;
    flushidx = 0;
    while (binding_callbacks.length) binding_callbacks.pop()();
    // then, once components are updated, call
    // afterUpdate functions. This may cause
    // subsequent updates...
    for (let i = 0; i < render_callbacks.length; i += 1) {
      const callback = render_callbacks[i];
      if (!seen_callbacks.has(callback)) {
        // ...so guard against infinite loops
        seen_callbacks.add(callback);
        callback();
      }
    }
    render_callbacks.length = 0;
  } while (dirty_components.length);
  while (flush_callbacks.length) {
    flush_callbacks.pop()();
  }
  update_scheduled = false;
  seen_callbacks.clear();
  set_current_component(saved_component);
}
function update($$) {
  if ($$.fragment !== null) {
    $$.update();
    run_all($$.before_update);
    const dirty = $$.dirty;
    $$.dirty = [-1];
    $$.fragment && $$.fragment.p($$.ctx, dirty);
    $$.after_update.forEach(add_render_callback);
  }
}
/**
 * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
 */
function flush_render_callbacks(fns) {
  const filtered = [];
  const targets = [];
  render_callbacks.forEach(c => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
  targets.forEach(c => c());
  render_callbacks = filtered;
}
const outroing = new Set();
let outros;
function group_outros() {
  outros = {
    r: 0,
    c: [],
    p: outros // parent group
  };
}
function check_outros() {
  if (!outros.r) {
    run_all(outros.c);
  }
  outros = outros.p;
}
function transition_in(block, local) {
  if (block && block.i) {
    outroing.delete(block);
    block.i(local);
  }
}
function transition_out(block, local, detach, callback) {
  if (block && block.o) {
    if (outroing.has(block)) return;
    outroing.add(block);
    outros.c.push(() => {
      outroing.delete(block);
      if (callback) {
        if (detach) block.d(1);
        callback();
      }
    });
    block.o(local);
  } else if (callback) {
    callback();
  }
}
function get_spread_update(levels, updates) {
  const update = {};
  const to_null_out = {};
  const accounted_for = {
    $$scope: 1
  };
  let i = levels.length;
  while (i--) {
    const o = levels[i];
    const n = updates[i];
    if (n) {
      for (const key in o) {
        if (!(key in n)) to_null_out[key] = 1;
      }
      for (const key in n) {
        if (!accounted_for[key]) {
          update[key] = n[key];
          accounted_for[key] = 1;
        }
      }
      levels[i] = n;
    } else {
      for (const key in o) {
        accounted_for[key] = 1;
      }
    }
  }
  for (const key in to_null_out) {
    if (!(key in update)) update[key] = undefined;
  }
  return update;
}
function create_component(block) {
  block && block.c();
}
function mount_component(component, target, anchor, customElement) {
  const {
    fragment,
    after_update
  } = component.$$;
  fragment && fragment.m(target, anchor);
  if (!customElement) {
    // onMount happens before the initial afterUpdate
    add_render_callback(() => {
      const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
      // if the component was destroyed immediately
      // it will update the `$$.on_destroy` reference to `null`.
      // the destructured on_destroy may still reference to the old array
      if (component.$$.on_destroy) {
        component.$$.on_destroy.push(...new_on_destroy);
      } else {
        // Edge case - component was destroyed immediately,
        // most likely as a result of a binding initialising
        run_all(new_on_destroy);
      }
      component.$$.on_mount = [];
    });
  }
  after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
  const $$ = component.$$;
  if ($$.fragment !== null) {
    flush_render_callbacks($$.after_update);
    run_all($$.on_destroy);
    $$.fragment && $$.fragment.d(detaching);
    // TODO null out other refs, including component.$$ (but need to
    // preserve final state?)
    $$.on_destroy = $$.fragment = null;
    $$.ctx = [];
  }
}
function make_dirty(component, i) {
  if (component.$$.dirty[0] === -1) {
    dirty_components.push(component);
    schedule_update();
    component.$$.dirty.fill(0);
  }
  component.$$.dirty[i / 31 | 0] |= 1 << i % 31;
}
function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
  const parent_component = current_component;
  set_current_component(component);
  const $$ = component.$$ = {
    fragment: null,
    ctx: [],
    // state
    props,
    update: noop,
    not_equal,
    bound: blank_object(),
    // lifecycle
    on_mount: [],
    on_destroy: [],
    on_disconnect: [],
    before_update: [],
    after_update: [],
    context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
    // everything else
    callbacks: blank_object(),
    dirty,
    skip_bound: false,
    root: options.target || parent_component.$$.root
  };
  append_styles && append_styles($$.root);
  let ready = false;
  $$.ctx = instance ? instance(component, options.props || {}, (i, ret, ...rest) => {
    const value = rest.length ? rest[0] : ret;
    if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
      if (!$$.skip_bound && $$.bound[i]) $$.bound[i](value);
      if (ready) make_dirty(component, i);
    }
    return ret;
  }) : [];
  $$.update();
  ready = true;
  run_all($$.before_update);
  // `false` as a special case of no DOM component
  $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
  if (options.target) {
    if (options.hydrate) {
      const nodes = children(options.target);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      $$.fragment && $$.fragment.l(nodes);
      nodes.forEach(detach);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      $$.fragment && $$.fragment.c();
    }
    if (options.intro) transition_in(component.$$.fragment);
    mount_component(component, options.target, options.anchor, options.customElement);
    flush();
  }
  set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
  $destroy() {
    destroy_component(this, 1);
    this.$destroy = noop;
  }
  $on(type, callback) {
    if (!is_function(callback)) {
      return noop;
    }
    const callbacks = this.$$.callbacks[type] || (this.$$.callbacks[type] = []);
    callbacks.push(callback);
    return () => {
      const index = callbacks.indexOf(callback);
      if (index !== -1) callbacks.splice(index, 1);
    };
  }
  $set($$props) {
    if (this.$$set && !is_empty($$props)) {
      this.$$.skip_bound = true;
      this.$$set($$props);
      this.$$.skip_bound = false;
    }
  }
}

/* src/components/shepherd-button.svelte generated by Svelte v3.59.2 */
function create_fragment$7(ctx) {
  let button;
  let button_aria_label_value;
  let button_class_value;
  let mounted;
  let dispose;
  return {
    c() {
      button = element("button");
      attr(button, "aria-label", button_aria_label_value = /*label*/ctx[3] ? /*label*/ctx[3] : null);
      attr(button, "class", button_class_value = `${/*classes*/ctx[1] || ''} shepherd-button ${/*secondary*/ctx[4] ? 'shepherd-button-secondary' : ''}`);
      button.disabled = /*disabled*/ctx[2];
      attr(button, "tabindex", "0");
    },
    m(target, anchor) {
      insert(target, button, anchor);
      button.innerHTML = /*text*/ctx[5];
      if (!mounted) {
        dispose = listen(button, "click", function () {
          if (is_function( /*action*/ctx[0])) /*action*/ctx[0].apply(this, arguments);
        });
        mounted = true;
      }
    },
    p(new_ctx, [dirty]) {
      ctx = new_ctx;
      if (dirty & /*text*/32) button.innerHTML = /*text*/ctx[5];
      if (dirty & /*label*/8 && button_aria_label_value !== (button_aria_label_value = /*label*/ctx[3] ? /*label*/ctx[3] : null)) {
        attr(button, "aria-label", button_aria_label_value);
      }
      if (dirty & /*classes, secondary*/18 && button_class_value !== (button_class_value = `${/*classes*/ctx[1] || ''} shepherd-button ${/*secondary*/ctx[4] ? 'shepherd-button-secondary' : ''}`)) {
        attr(button, "class", button_class_value);
      }
      if (dirty & /*disabled*/4) {
        button.disabled = /*disabled*/ctx[2];
      }
    },
    i: noop,
    o: noop,
    d(detaching) {
      if (detaching) detach(button);
      mounted = false;
      dispose();
    }
  };
}
function instance$7($$self, $$props, $$invalidate) {
  let {
    config,
    step
  } = $$props;
  let action, classes, disabled, label, secondary, text;
  function getConfigOption(option) {
    if (isFunction(option)) {
      return option = option.call(step);
    }
    return option;
  }
  $$self.$$set = $$props => {
    if ('config' in $$props) $$invalidate(6, config = $$props.config);
    if ('step' in $$props) $$invalidate(7, step = $$props.step);
  };
  $$self.$$.update = () => {
    if ($$self.$$.dirty & /*config, step*/192) {
      {
        $$invalidate(0, action = config.action ? config.action.bind(step.tour) : null);
        $$invalidate(1, classes = config.classes);
        $$invalidate(2, disabled = config.disabled ? getConfigOption(config.disabled) : false);
        $$invalidate(3, label = config.label ? getConfigOption(config.label) : null);
        $$invalidate(4, secondary = config.secondary);
        $$invalidate(5, text = config.text ? getConfigOption(config.text) : null);
      }
    }
  };
  return [action, classes, disabled, label, secondary, text, config, step];
}
class Shepherd_button extends SvelteComponent {
  constructor(options) {
    super();
    init(this, options, instance$7, create_fragment$7, safe_not_equal, {
      config: 6,
      step: 7
    });
  }
}

/* src/components/shepherd-footer.svelte generated by Svelte v3.59.2 */
function get_each_context(ctx, list, i) {
  const child_ctx = ctx.slice();
  child_ctx[2] = list[i];
  return child_ctx;
}

// (24:4) {#if buttons}
function create_if_block$3(ctx) {
  let each_1_anchor;
  let current;
  let each_value = /*buttons*/ctx[1];
  let each_blocks = [];
  for (let i = 0; i < each_value.length; i += 1) {
    each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
  }
  const out = i => transition_out(each_blocks[i], 1, 1, () => {
    each_blocks[i] = null;
  });
  return {
    c() {
      for (let i = 0; i < each_blocks.length; i += 1) {
        each_blocks[i].c();
      }
      each_1_anchor = empty();
    },
    m(target, anchor) {
      for (let i = 0; i < each_blocks.length; i += 1) {
        if (each_blocks[i]) {
          each_blocks[i].m(target, anchor);
        }
      }
      insert(target, each_1_anchor, anchor);
      current = true;
    },
    p(ctx, dirty) {
      if (dirty & /*buttons, step*/3) {
        each_value = /*buttons*/ctx[1];
        let i;
        for (i = 0; i < each_value.length; i += 1) {
          const child_ctx = get_each_context(ctx, each_value, i);
          if (each_blocks[i]) {
            each_blocks[i].p(child_ctx, dirty);
            transition_in(each_blocks[i], 1);
          } else {
            each_blocks[i] = create_each_block(child_ctx);
            each_blocks[i].c();
            transition_in(each_blocks[i], 1);
            each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
          }
        }
        group_outros();
        for (i = each_value.length; i < each_blocks.length; i += 1) {
          out(i);
        }
        check_outros();
      }
    },
    i(local) {
      if (current) return;
      for (let i = 0; i < each_value.length; i += 1) {
        transition_in(each_blocks[i]);
      }
      current = true;
    },
    o(local) {
      each_blocks = each_blocks.filter(Boolean);
      for (let i = 0; i < each_blocks.length; i += 1) {
        transition_out(each_blocks[i]);
      }
      current = false;
    },
    d(detaching) {
      destroy_each(each_blocks, detaching);
      if (detaching) detach(each_1_anchor);
    }
  };
}

// (25:8) {#each buttons as config}
function create_each_block(ctx) {
  let shepherdbutton;
  let current;
  shepherdbutton = new Shepherd_button({
    props: {
      config: /*config*/ctx[2],
      step: /*step*/ctx[0]
    }
  });
  return {
    c() {
      create_component(shepherdbutton.$$.fragment);
    },
    m(target, anchor) {
      mount_component(shepherdbutton, target, anchor);
      current = true;
    },
    p(ctx, dirty) {
      const shepherdbutton_changes = {};
      if (dirty & /*buttons*/2) shepherdbutton_changes.config = /*config*/ctx[2];
      if (dirty & /*step*/1) shepherdbutton_changes.step = /*step*/ctx[0];
      shepherdbutton.$set(shepherdbutton_changes);
    },
    i(local) {
      if (current) return;
      transition_in(shepherdbutton.$$.fragment, local);
      current = true;
    },
    o(local) {
      transition_out(shepherdbutton.$$.fragment, local);
      current = false;
    },
    d(detaching) {
      destroy_component(shepherdbutton, detaching);
    }
  };
}
function create_fragment$6(ctx) {
  let footer;
  let current;
  let if_block = /*buttons*/ctx[1] && create_if_block$3(ctx);
  return {
    c() {
      footer = element("footer");
      if (if_block) if_block.c();
      attr(footer, "class", "shepherd-footer");
    },
    m(target, anchor) {
      insert(target, footer, anchor);
      if (if_block) if_block.m(footer, null);
      current = true;
    },
    p(ctx, [dirty]) {
      if ( /*buttons*/ctx[1]) {
        if (if_block) {
          if_block.p(ctx, dirty);
          if (dirty & /*buttons*/2) {
            transition_in(if_block, 1);
          }
        } else {
          if_block = create_if_block$3(ctx);
          if_block.c();
          transition_in(if_block, 1);
          if_block.m(footer, null);
        }
      } else if (if_block) {
        group_outros();
        transition_out(if_block, 1, 1, () => {
          if_block = null;
        });
        check_outros();
      }
    },
    i(local) {
      if (current) return;
      transition_in(if_block);
      current = true;
    },
    o(local) {
      transition_out(if_block);
      current = false;
    },
    d(detaching) {
      if (detaching) detach(footer);
      if (if_block) if_block.d();
    }
  };
}
function instance$6($$self, $$props, $$invalidate) {
  let buttons;
  let {
    step
  } = $$props;
  $$self.$$set = $$props => {
    if ('step' in $$props) $$invalidate(0, step = $$props.step);
  };
  $$self.$$.update = () => {
    if ($$self.$$.dirty & /*step*/1) {
      $$invalidate(1, buttons = step.options.buttons);
    }
  };
  return [step, buttons];
}
class Shepherd_footer extends SvelteComponent {
  constructor(options) {
    super();
    init(this, options, instance$6, create_fragment$6, safe_not_equal, {
      step: 0
    });
  }
}

/* src/components/shepherd-cancel-icon.svelte generated by Svelte v3.59.2 */
function create_fragment$5(ctx) {
  let button;
  let span;
  let button_aria_label_value;
  let mounted;
  let dispose;
  return {
    c() {
      button = element("button");
      span = element("span");
      span.textContent = "×";
      attr(span, "aria-hidden", "true");
      attr(button, "aria-label", button_aria_label_value = /*cancelIcon*/ctx[0].label ? /*cancelIcon*/ctx[0].label : 'Close Tour');
      attr(button, "class", "shepherd-cancel-icon");
      attr(button, "type", "button");
    },
    m(target, anchor) {
      insert(target, button, anchor);
      append(button, span);
      if (!mounted) {
        dispose = listen(button, "click", /*handleCancelClick*/ctx[1]);
        mounted = true;
      }
    },
    p(ctx, [dirty]) {
      if (dirty & /*cancelIcon*/1 && button_aria_label_value !== (button_aria_label_value = /*cancelIcon*/ctx[0].label ? /*cancelIcon*/ctx[0].label : 'Close Tour')) {
        attr(button, "aria-label", button_aria_label_value);
      }
    },
    i: noop,
    o: noop,
    d(detaching) {
      if (detaching) detach(button);
      mounted = false;
      dispose();
    }
  };
}
function instance$5($$self, $$props, $$invalidate) {
  let {
    cancelIcon,
    step
  } = $$props;

  /**
  * Add a click listener to the cancel link that cancels the tour
  */
  const handleCancelClick = e => {
    e.preventDefault();
    step.cancel();
  };
  $$self.$$set = $$props => {
    if ('cancelIcon' in $$props) $$invalidate(0, cancelIcon = $$props.cancelIcon);
    if ('step' in $$props) $$invalidate(2, step = $$props.step);
  };
  return [cancelIcon, handleCancelClick, step];
}
class Shepherd_cancel_icon extends SvelteComponent {
  constructor(options) {
    super();
    init(this, options, instance$5, create_fragment$5, safe_not_equal, {
      cancelIcon: 0,
      step: 2
    });
  }
}

/* src/components/shepherd-title.svelte generated by Svelte v3.59.2 */
function create_fragment$4(ctx) {
  let h3;
  return {
    c() {
      h3 = element("h3");
      attr(h3, "id", /*labelId*/ctx[1]);
      attr(h3, "class", "shepherd-title");
    },
    m(target, anchor) {
      insert(target, h3, anchor);
      /*h3_binding*/
      ctx[3](h3);
    },
    p(ctx, [dirty]) {
      if (dirty & /*labelId*/2) {
        attr(h3, "id", /*labelId*/ctx[1]);
      }
    },
    i: noop,
    o: noop,
    d(detaching) {
      if (detaching) detach(h3);
      /*h3_binding*/
      ctx[3](null);
    }
  };
}
function instance$4($$self, $$props, $$invalidate) {
  let {
    labelId,
    element,
    title
  } = $$props;
  afterUpdate(() => {
    if (isFunction(title)) {
      $$invalidate(2, title = title());
    }
    $$invalidate(0, element.innerHTML = title, element);
  });
  function h3_binding($$value) {
    binding_callbacks[$$value ? 'unshift' : 'push'](() => {
      element = $$value;
      $$invalidate(0, element);
    });
  }
  $$self.$$set = $$props => {
    if ('labelId' in $$props) $$invalidate(1, labelId = $$props.labelId);
    if ('element' in $$props) $$invalidate(0, element = $$props.element);
    if ('title' in $$props) $$invalidate(2, title = $$props.title);
  };
  return [element, labelId, title, h3_binding];
}
class Shepherd_title extends SvelteComponent {
  constructor(options) {
    super();
    init(this, options, instance$4, create_fragment$4, safe_not_equal, {
      labelId: 1,
      element: 0,
      title: 2
    });
  }
}

/* src/components/shepherd-header.svelte generated by Svelte v3.59.2 */
function create_if_block_1$1(ctx) {
  let shepherdtitle;
  let current;
  shepherdtitle = new Shepherd_title({
    props: {
      labelId: /*labelId*/ctx[0],
      title: /*title*/ctx[2]
    }
  });
  return {
    c() {
      create_component(shepherdtitle.$$.fragment);
    },
    m(target, anchor) {
      mount_component(shepherdtitle, target, anchor);
      current = true;
    },
    p(ctx, dirty) {
      const shepherdtitle_changes = {};
      if (dirty & /*labelId*/1) shepherdtitle_changes.labelId = /*labelId*/ctx[0];
      if (dirty & /*title*/4) shepherdtitle_changes.title = /*title*/ctx[2];
      shepherdtitle.$set(shepherdtitle_changes);
    },
    i(local) {
      if (current) return;
      transition_in(shepherdtitle.$$.fragment, local);
      current = true;
    },
    o(local) {
      transition_out(shepherdtitle.$$.fragment, local);
      current = false;
    },
    d(detaching) {
      destroy_component(shepherdtitle, detaching);
    }
  };
}

// (39:4) {#if cancelIcon && cancelIcon.enabled}
function create_if_block$2(ctx) {
  let shepherdcancelicon;
  let current;
  shepherdcancelicon = new Shepherd_cancel_icon({
    props: {
      cancelIcon: /*cancelIcon*/ctx[3],
      step: /*step*/ctx[1]
    }
  });
  return {
    c() {
      create_component(shepherdcancelicon.$$.fragment);
    },
    m(target, anchor) {
      mount_component(shepherdcancelicon, target, anchor);
      current = true;
    },
    p(ctx, dirty) {
      const shepherdcancelicon_changes = {};
      if (dirty & /*cancelIcon*/8) shepherdcancelicon_changes.cancelIcon = /*cancelIcon*/ctx[3];
      if (dirty & /*step*/2) shepherdcancelicon_changes.step = /*step*/ctx[1];
      shepherdcancelicon.$set(shepherdcancelicon_changes);
    },
    i(local) {
      if (current) return;
      transition_in(shepherdcancelicon.$$.fragment, local);
      current = true;
    },
    o(local) {
      transition_out(shepherdcancelicon.$$.fragment, local);
      current = false;
    },
    d(detaching) {
      destroy_component(shepherdcancelicon, detaching);
    }
  };
}
function create_fragment$3(ctx) {
  let header;
  let t;
  let current;
  let if_block0 = /*title*/ctx[2] && create_if_block_1$1(ctx);
  let if_block1 = /*cancelIcon*/ctx[3] && /*cancelIcon*/ctx[3].enabled && create_if_block$2(ctx);
  return {
    c() {
      header = element("header");
      if (if_block0) if_block0.c();
      t = space();
      if (if_block1) if_block1.c();
      attr(header, "class", "shepherd-header");
    },
    m(target, anchor) {
      insert(target, header, anchor);
      if (if_block0) if_block0.m(header, null);
      append(header, t);
      if (if_block1) if_block1.m(header, null);
      current = true;
    },
    p(ctx, [dirty]) {
      if ( /*title*/ctx[2]) {
        if (if_block0) {
          if_block0.p(ctx, dirty);
          if (dirty & /*title*/4) {
            transition_in(if_block0, 1);
          }
        } else {
          if_block0 = create_if_block_1$1(ctx);
          if_block0.c();
          transition_in(if_block0, 1);
          if_block0.m(header, t);
        }
      } else if (if_block0) {
        group_outros();
        transition_out(if_block0, 1, 1, () => {
          if_block0 = null;
        });
        check_outros();
      }
      if ( /*cancelIcon*/ctx[3] && /*cancelIcon*/ctx[3].enabled) {
        if (if_block1) {
          if_block1.p(ctx, dirty);
          if (dirty & /*cancelIcon*/8) {
            transition_in(if_block1, 1);
          }
        } else {
          if_block1 = create_if_block$2(ctx);
          if_block1.c();
          transition_in(if_block1, 1);
          if_block1.m(header, null);
        }
      } else if (if_block1) {
        group_outros();
        transition_out(if_block1, 1, 1, () => {
          if_block1 = null;
        });
        check_outros();
      }
    },
    i(local) {
      if (current) return;
      transition_in(if_block0);
      transition_in(if_block1);
      current = true;
    },
    o(local) {
      transition_out(if_block0);
      transition_out(if_block1);
      current = false;
    },
    d(detaching) {
      if (detaching) detach(header);
      if (if_block0) if_block0.d();
      if (if_block1) if_block1.d();
    }
  };
}
function instance$3($$self, $$props, $$invalidate) {
  let {
    labelId,
    step
  } = $$props;
  let title, cancelIcon;
  $$self.$$set = $$props => {
    if ('labelId' in $$props) $$invalidate(0, labelId = $$props.labelId);
    if ('step' in $$props) $$invalidate(1, step = $$props.step);
  };
  $$self.$$.update = () => {
    if ($$self.$$.dirty & /*step*/2) {
      {
        $$invalidate(2, title = step.options.title);
        $$invalidate(3, cancelIcon = step.options.cancelIcon);
      }
    }
  };
  return [labelId, step, title, cancelIcon];
}
class Shepherd_header extends SvelteComponent {
  constructor(options) {
    super();
    init(this, options, instance$3, create_fragment$3, safe_not_equal, {
      labelId: 0,
      step: 1
    });
  }
}

/* src/components/shepherd-text.svelte generated by Svelte v3.59.2 */
function create_fragment$2(ctx) {
  let div;
  return {
    c() {
      div = element("div");
      attr(div, "class", "shepherd-text");
      attr(div, "id", /*descriptionId*/ctx[1]);
    },
    m(target, anchor) {
      insert(target, div, anchor);
      /*div_binding*/
      ctx[3](div);
    },
    p(ctx, [dirty]) {
      if (dirty & /*descriptionId*/2) {
        attr(div, "id", /*descriptionId*/ctx[1]);
      }
    },
    i: noop,
    o: noop,
    d(detaching) {
      if (detaching) detach(div);
      /*div_binding*/
      ctx[3](null);
    }
  };
}
function instance$2($$self, $$props, $$invalidate) {
  let {
    descriptionId,
    element,
    step
  } = $$props;
  afterUpdate(() => {
    let {
      text
    } = step.options;
    if (isFunction(text)) {
      text = text.call(step);
    }
    if (isHTMLElement(text)) {
      element.appendChild(text);
    } else {
      $$invalidate(0, element.innerHTML = text, element);
    }
  });
  function div_binding($$value) {
    binding_callbacks[$$value ? 'unshift' : 'push'](() => {
      element = $$value;
      $$invalidate(0, element);
    });
  }
  $$self.$$set = $$props => {
    if ('descriptionId' in $$props) $$invalidate(1, descriptionId = $$props.descriptionId);
    if ('element' in $$props) $$invalidate(0, element = $$props.element);
    if ('step' in $$props) $$invalidate(2, step = $$props.step);
  };
  return [element, descriptionId, step, div_binding];
}
class Shepherd_text extends SvelteComponent {
  constructor(options) {
    super();
    init(this, options, instance$2, create_fragment$2, safe_not_equal, {
      descriptionId: 1,
      element: 0,
      step: 2
    });
  }
}

/* src/components/shepherd-content.svelte generated by Svelte v3.59.2 */
function create_if_block_2(ctx) {
  let shepherdheader;
  let current;
  shepherdheader = new Shepherd_header({
    props: {
      labelId: /*labelId*/ctx[1],
      step: /*step*/ctx[2]
    }
  });
  return {
    c() {
      create_component(shepherdheader.$$.fragment);
    },
    m(target, anchor) {
      mount_component(shepherdheader, target, anchor);
      current = true;
    },
    p(ctx, dirty) {
      const shepherdheader_changes = {};
      if (dirty & /*labelId*/2) shepherdheader_changes.labelId = /*labelId*/ctx[1];
      if (dirty & /*step*/4) shepherdheader_changes.step = /*step*/ctx[2];
      shepherdheader.$set(shepherdheader_changes);
    },
    i(local) {
      if (current) return;
      transition_in(shepherdheader.$$.fragment, local);
      current = true;
    },
    o(local) {
      transition_out(shepherdheader.$$.fragment, local);
      current = false;
    },
    d(detaching) {
      destroy_component(shepherdheader, detaching);
    }
  };
}

// (28:2) {#if !isUndefined(step.options.text)}
function create_if_block_1(ctx) {
  let shepherdtext;
  let current;
  shepherdtext = new Shepherd_text({
    props: {
      descriptionId: /*descriptionId*/ctx[0],
      step: /*step*/ctx[2]
    }
  });
  return {
    c() {
      create_component(shepherdtext.$$.fragment);
    },
    m(target, anchor) {
      mount_component(shepherdtext, target, anchor);
      current = true;
    },
    p(ctx, dirty) {
      const shepherdtext_changes = {};
      if (dirty & /*descriptionId*/1) shepherdtext_changes.descriptionId = /*descriptionId*/ctx[0];
      if (dirty & /*step*/4) shepherdtext_changes.step = /*step*/ctx[2];
      shepherdtext.$set(shepherdtext_changes);
    },
    i(local) {
      if (current) return;
      transition_in(shepherdtext.$$.fragment, local);
      current = true;
    },
    o(local) {
      transition_out(shepherdtext.$$.fragment, local);
      current = false;
    },
    d(detaching) {
      destroy_component(shepherdtext, detaching);
    }
  };
}

// (35:2) {#if Array.isArray(step.options.buttons) && step.options.buttons.length}
function create_if_block$1(ctx) {
  let shepherdfooter;
  let current;
  shepherdfooter = new Shepherd_footer({
    props: {
      step: /*step*/ctx[2]
    }
  });
  return {
    c() {
      create_component(shepherdfooter.$$.fragment);
    },
    m(target, anchor) {
      mount_component(shepherdfooter, target, anchor);
      current = true;
    },
    p(ctx, dirty) {
      const shepherdfooter_changes = {};
      if (dirty & /*step*/4) shepherdfooter_changes.step = /*step*/ctx[2];
      shepherdfooter.$set(shepherdfooter_changes);
    },
    i(local) {
      if (current) return;
      transition_in(shepherdfooter.$$.fragment, local);
      current = true;
    },
    o(local) {
      transition_out(shepherdfooter.$$.fragment, local);
      current = false;
    },
    d(detaching) {
      destroy_component(shepherdfooter, detaching);
    }
  };
}
function create_fragment$1(ctx) {
  let div;
  let show_if_2 = !isUndefined( /*step*/ctx[2].options.title) || /*step*/ctx[2].options.cancelIcon && /*step*/ctx[2].options.cancelIcon.enabled;
  let t0;
  let show_if_1 = !isUndefined( /*step*/ctx[2].options.text);
  let t1;
  let show_if = Array.isArray( /*step*/ctx[2].options.buttons) && /*step*/ctx[2].options.buttons.length;
  let current;
  let if_block0 = show_if_2 && create_if_block_2(ctx);
  let if_block1 = show_if_1 && create_if_block_1(ctx);
  let if_block2 = show_if && create_if_block$1(ctx);
  return {
    c() {
      div = element("div");
      if (if_block0) if_block0.c();
      t0 = space();
      if (if_block1) if_block1.c();
      t1 = space();
      if (if_block2) if_block2.c();
      attr(div, "class", "shepherd-content");
    },
    m(target, anchor) {
      insert(target, div, anchor);
      if (if_block0) if_block0.m(div, null);
      append(div, t0);
      if (if_block1) if_block1.m(div, null);
      append(div, t1);
      if (if_block2) if_block2.m(div, null);
      current = true;
    },
    p(ctx, [dirty]) {
      if (dirty & /*step*/4) show_if_2 = !isUndefined( /*step*/ctx[2].options.title) || /*step*/ctx[2].options.cancelIcon && /*step*/ctx[2].options.cancelIcon.enabled;
      if (show_if_2) {
        if (if_block0) {
          if_block0.p(ctx, dirty);
          if (dirty & /*step*/4) {
            transition_in(if_block0, 1);
          }
        } else {
          if_block0 = create_if_block_2(ctx);
          if_block0.c();
          transition_in(if_block0, 1);
          if_block0.m(div, t0);
        }
      } else if (if_block0) {
        group_outros();
        transition_out(if_block0, 1, 1, () => {
          if_block0 = null;
        });
        check_outros();
      }
      if (dirty & /*step*/4) show_if_1 = !isUndefined( /*step*/ctx[2].options.text);
      if (show_if_1) {
        if (if_block1) {
          if_block1.p(ctx, dirty);
          if (dirty & /*step*/4) {
            transition_in(if_block1, 1);
          }
        } else {
          if_block1 = create_if_block_1(ctx);
          if_block1.c();
          transition_in(if_block1, 1);
          if_block1.m(div, t1);
        }
      } else if (if_block1) {
        group_outros();
        transition_out(if_block1, 1, 1, () => {
          if_block1 = null;
        });
        check_outros();
      }
      if (dirty & /*step*/4) show_if = Array.isArray( /*step*/ctx[2].options.buttons) && /*step*/ctx[2].options.buttons.length;
      if (show_if) {
        if (if_block2) {
          if_block2.p(ctx, dirty);
          if (dirty & /*step*/4) {
            transition_in(if_block2, 1);
          }
        } else {
          if_block2 = create_if_block$1(ctx);
          if_block2.c();
          transition_in(if_block2, 1);
          if_block2.m(div, null);
        }
      } else if (if_block2) {
        group_outros();
        transition_out(if_block2, 1, 1, () => {
          if_block2 = null;
        });
        check_outros();
      }
    },
    i(local) {
      if (current) return;
      transition_in(if_block0);
      transition_in(if_block1);
      transition_in(if_block2);
      current = true;
    },
    o(local) {
      transition_out(if_block0);
      transition_out(if_block1);
      transition_out(if_block2);
      current = false;
    },
    d(detaching) {
      if (detaching) detach(div);
      if (if_block0) if_block0.d();
      if (if_block1) if_block1.d();
      if (if_block2) if_block2.d();
    }
  };
}
function instance$1($$self, $$props, $$invalidate) {
  let {
    descriptionId,
    labelId,
    step
  } = $$props;
  $$self.$$set = $$props => {
    if ('descriptionId' in $$props) $$invalidate(0, descriptionId = $$props.descriptionId);
    if ('labelId' in $$props) $$invalidate(1, labelId = $$props.labelId);
    if ('step' in $$props) $$invalidate(2, step = $$props.step);
  };
  return [descriptionId, labelId, step];
}
class Shepherd_content extends SvelteComponent {
  constructor(options) {
    super();
    init(this, options, instance$1, create_fragment$1, safe_not_equal, {
      descriptionId: 0,
      labelId: 1,
      step: 2
    });
  }
}

/* src/components/shepherd-element.svelte generated by Svelte v3.59.2 */
function create_if_block(ctx) {
  let div;
  return {
    c() {
      div = element("div");
      attr(div, "class", "shepherd-arrow");
      attr(div, "data-popper-arrow", "");
    },
    m(target, anchor) {
      insert(target, div, anchor);
    },
    d(detaching) {
      if (detaching) detach(div);
    }
  };
}
function create_fragment(ctx) {
  let div;
  let t;
  let shepherdcontent;
  let div_aria_describedby_value;
  let div_aria_labelledby_value;
  let current;
  let mounted;
  let dispose;
  let if_block = /*step*/ctx[4].options.arrow && /*step*/ctx[4].options.attachTo && /*step*/ctx[4].options.attachTo.element && /*step*/ctx[4].options.attachTo.on && create_if_block();
  shepherdcontent = new Shepherd_content({
    props: {
      descriptionId: /*descriptionId*/ctx[2],
      labelId: /*labelId*/ctx[3],
      step: /*step*/ctx[4]
    }
  });
  let div_levels = [{
    "aria-describedby": div_aria_describedby_value = !isUndefined( /*step*/ctx[4].options.text) ? /*descriptionId*/ctx[2] : null
  }, {
    "aria-labelledby": div_aria_labelledby_value = /*step*/ctx[4].options.title ? /*labelId*/ctx[3] : null
  }, /*dataStepId*/ctx[1], {
    role: "dialog"
  }, {
    tabindex: "0"
  }];
  let div_data = {};
  for (let i = 0; i < div_levels.length; i += 1) {
    div_data = assign(div_data, div_levels[i]);
  }
  return {
    c() {
      div = element("div");
      if (if_block) if_block.c();
      t = space();
      create_component(shepherdcontent.$$.fragment);
      set_attributes(div, div_data);
      toggle_class(div, "shepherd-has-cancel-icon", /*hasCancelIcon*/ctx[5]);
      toggle_class(div, "shepherd-has-title", /*hasTitle*/ctx[6]);
      toggle_class(div, "shepherd-element", true);
    },
    m(target, anchor) {
      insert(target, div, anchor);
      if (if_block) if_block.m(div, null);
      append(div, t);
      mount_component(shepherdcontent, div, null);
      /*div_binding*/
      ctx[13](div);
      current = true;
      if (!mounted) {
        dispose = listen(div, "keydown", /*handleKeyDown*/ctx[7]);
        mounted = true;
      }
    },
    p(ctx, [dirty]) {
      if ( /*step*/ctx[4].options.arrow && /*step*/ctx[4].options.attachTo && /*step*/ctx[4].options.attachTo.element && /*step*/ctx[4].options.attachTo.on) {
        if (if_block) ; else {
          if_block = create_if_block();
          if_block.c();
          if_block.m(div, t);
        }
      } else if (if_block) {
        if_block.d(1);
        if_block = null;
      }
      const shepherdcontent_changes = {};
      if (dirty & /*descriptionId*/4) shepherdcontent_changes.descriptionId = /*descriptionId*/ctx[2];
      if (dirty & /*labelId*/8) shepherdcontent_changes.labelId = /*labelId*/ctx[3];
      if (dirty & /*step*/16) shepherdcontent_changes.step = /*step*/ctx[4];
      shepherdcontent.$set(shepherdcontent_changes);
      set_attributes(div, div_data = get_spread_update(div_levels, [(!current || dirty & /*step, descriptionId*/20 && div_aria_describedby_value !== (div_aria_describedby_value = !isUndefined( /*step*/ctx[4].options.text) ? /*descriptionId*/ctx[2] : null)) && {
        "aria-describedby": div_aria_describedby_value
      }, (!current || dirty & /*step, labelId*/24 && div_aria_labelledby_value !== (div_aria_labelledby_value = /*step*/ctx[4].options.title ? /*labelId*/ctx[3] : null)) && {
        "aria-labelledby": div_aria_labelledby_value
      }, dirty & /*dataStepId*/2 && /*dataStepId*/ctx[1], {
        role: "dialog"
      }, {
        tabindex: "0"
      }]));
      toggle_class(div, "shepherd-has-cancel-icon", /*hasCancelIcon*/ctx[5]);
      toggle_class(div, "shepherd-has-title", /*hasTitle*/ctx[6]);
      toggle_class(div, "shepherd-element", true);
    },
    i(local) {
      if (current) return;
      transition_in(shepherdcontent.$$.fragment, local);
      current = true;
    },
    o(local) {
      transition_out(shepherdcontent.$$.fragment, local);
      current = false;
    },
    d(detaching) {
      if (detaching) detach(div);
      if (if_block) if_block.d();
      destroy_component(shepherdcontent);
      /*div_binding*/
      ctx[13](null);
      mounted = false;
      dispose();
    }
  };
}
const KEY_TAB = 9;
const KEY_ESC = 27;
const LEFT_ARROW = 37;
const RIGHT_ARROW = 39;
function getClassesArray(classes) {
  return classes.split(' ').filter(className => !!className.length);
}
function instance($$self, $$props, $$invalidate) {
  let {
    classPrefix,
    element,
    descriptionId,
    firstFocusableElement,
    focusableElements,
    labelId,
    lastFocusableElement,
    step,
    dataStepId
  } = $$props;
  let hasCancelIcon, hasTitle, classes;
  const getElement = () => element;
  onMount(() => {
    // Get all elements that are focusable
    $$invalidate(1, dataStepId = {
      [`data-${classPrefix}shepherd-step-id`]: step.id
    });
    $$invalidate(9, focusableElements = element.querySelectorAll('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]'));
    $$invalidate(8, firstFocusableElement = focusableElements[0]);
    $$invalidate(10, lastFocusableElement = focusableElements[focusableElements.length - 1]);
  });
  afterUpdate(() => {
    if (classes !== step.options.classes) {
      updateDynamicClasses();
    }
  });
  function updateDynamicClasses() {
    removeClasses(classes);
    classes = step.options.classes;
    addClasses(classes);
  }
  function removeClasses(classes) {
    if (isString(classes)) {
      const oldClasses = getClassesArray(classes);
      if (oldClasses.length) {
        element.classList.remove(...oldClasses);
      }
    }
  }
  function addClasses(classes) {
    if (isString(classes)) {
      const newClasses = getClassesArray(classes);
      if (newClasses.length) {
        element.classList.add(...newClasses);
      }
    }
  }

  /**
  * Setup keydown events to allow closing the modal with ESC
  *
  * Borrowed from this great post! https://bitsofco.de/accessible-modal-dialog/
  *
  * @private
  */
  const handleKeyDown = e => {
    const {
      tour
    } = step;
    switch (e.keyCode) {
      case KEY_TAB:
        if (focusableElements.length === 0) {
          e.preventDefault();
          break;
        }
        // Backward tab
        if (e.shiftKey) {
          if (document.activeElement === firstFocusableElement || document.activeElement.classList.contains('shepherd-element')) {
            e.preventDefault();
            lastFocusableElement.focus();
          }
        } else {
          if (document.activeElement === lastFocusableElement) {
            e.preventDefault();
            firstFocusableElement.focus();
          }
        }
        break;
      case KEY_ESC:
        if (tour.options.exitOnEsc) {
          e.preventDefault();
          e.stopPropagation();
          step.cancel();
        }
        break;
      case LEFT_ARROW:
        if (tour.options.keyboardNavigation) {
          e.preventDefault();
          e.stopPropagation();
          tour.back();
        }
        break;
      case RIGHT_ARROW:
        if (tour.options.keyboardNavigation) {
          e.preventDefault();
          e.stopPropagation();
          tour.next();
        }
        break;
    }
  };
  function div_binding($$value) {
    binding_callbacks[$$value ? 'unshift' : 'push'](() => {
      element = $$value;
      $$invalidate(0, element);
    });
  }
  $$self.$$set = $$props => {
    if ('classPrefix' in $$props) $$invalidate(11, classPrefix = $$props.classPrefix);
    if ('element' in $$props) $$invalidate(0, element = $$props.element);
    if ('descriptionId' in $$props) $$invalidate(2, descriptionId = $$props.descriptionId);
    if ('firstFocusableElement' in $$props) $$invalidate(8, firstFocusableElement = $$props.firstFocusableElement);
    if ('focusableElements' in $$props) $$invalidate(9, focusableElements = $$props.focusableElements);
    if ('labelId' in $$props) $$invalidate(3, labelId = $$props.labelId);
    if ('lastFocusableElement' in $$props) $$invalidate(10, lastFocusableElement = $$props.lastFocusableElement);
    if ('step' in $$props) $$invalidate(4, step = $$props.step);
    if ('dataStepId' in $$props) $$invalidate(1, dataStepId = $$props.dataStepId);
  };
  $$self.$$.update = () => {
    if ($$self.$$.dirty & /*step*/16) {
      {
        $$invalidate(5, hasCancelIcon = step.options && step.options.cancelIcon && step.options.cancelIcon.enabled);
        $$invalidate(6, hasTitle = step.options && step.options.title);
      }
    }
  };
  return [element, dataStepId, descriptionId, labelId, step, hasCancelIcon, hasTitle, handleKeyDown, firstFocusableElement, focusableElements, lastFocusableElement, classPrefix, getElement, div_binding];
}
class Shepherd_element extends SvelteComponent {
  constructor(options) {
    super();
    init(this, options, instance, create_fragment, safe_not_equal, {
      classPrefix: 11,
      element: 0,
      descriptionId: 2,
      firstFocusableElement: 8,
      focusableElements: 9,
      labelId: 3,
      lastFocusableElement: 10,
      step: 4,
      dataStepId: 1,
      getElement: 12
    });
  }
  get getElement() {
    return this.$$.ctx[12];
  }
}

/**
 * A class representing steps to be added to a tour.
 * @extends {Evented}
 */
class Step extends Evented {
    constructor(tour, options = {}) {
        super();
        this.tour = tour;
        this.classPrefix = this.tour.options
            ? normalizePrefix(this.tour.options.classPrefix)
            : '';
        // @ts-expect-error TODO: investigate where styles comes from
        this.styles = tour.styles;
        /**
         * Resolved attachTo options. Due to lazy evaluation, we only resolve the options during `before-show` phase.
         * Do not use this directly, use the _getResolvedAttachToOptions method instead.
         * @type {null|{}|{element, to}}
         * @private
         */
        this._resolvedAttachTo = null;
        autoBind(this);
        this._setOptions(options);
        return this;
    }
    /**
     * Cancel the tour
     * Triggers the `cancel` event
     */
    cancel() {
        this.tour.cancel();
        this.trigger('cancel');
    }
    /**
     * Complete the tour
     * Triggers the `complete` event
     */
    complete() {
        this.tour.complete();
        this.trigger('complete');
    }
    /**
     * Remove the step, delete the step's element, and destroy the FloatingUI instance for the step.
     * Triggers `destroy` event
     */
    destroy() {
        destroyTooltip(this);
        if (isHTMLElement(this.el)) {
            this.el.remove();
            this.el = null;
        }
        this._updateStepTargetOnHide();
        this.trigger('destroy');
    }
    /**
     * Returns the tour for the step
     * @return The tour instance
     */
    getTour() {
        return this.tour;
    }
    /**
     * Hide the step
     */
    hide() {
        this.tour.modal.hide();
        this.trigger('before-hide');
        if (this.el) {
            this.el.hidden = true;
        }
        this._updateStepTargetOnHide();
        this.trigger('hide');
    }
    /**
     * Resolves attachTo options.
     * @returns {{}|{element, on}}
     */
    _resolveAttachToOptions() {
        this._resolvedAttachTo = parseAttachTo(this);
        return this._resolvedAttachTo;
    }
    /**
     * A selector for resolved attachTo options.
     * @returns {{}|{element, on}}
     * @private
     */
    _getResolvedAttachToOptions() {
        if (this._resolvedAttachTo === null) {
            return this._resolveAttachToOptions();
        }
        return this._resolvedAttachTo;
    }
    /**
     * Check if the step is open and visible
     * @return True if the step is open and visible
     */
    isOpen() {
        return Boolean(this.el && !this.el.hidden);
    }
    /**
     * Wraps `_show` and ensures `beforeShowPromise` resolves before calling show
     */
    show() {
        if (isFunction(this.options.beforeShowPromise)) {
            return Promise.resolve(this.options.beforeShowPromise()).then(() => this._show());
        }
        return Promise.resolve(this._show());
    }
    /**
     * Updates the options of the step.
     *
     * @param options The options for the step
     */
    updateStepOptions(options) {
        Object.assign(this.options, options);
        // @ts-expect-error TODO: get types for Svelte components
        if (this.shepherdElementComponent) {
            // @ts-expect-error TODO: get types for Svelte components
            this.shepherdElementComponent.$set({ step: this });
        }
    }
    /**
     * Returns the element for the step
     * @return {HTMLElement|null|undefined} The element instance. undefined if it has never been shown, null if it has been destroyed
     */
    getElement() {
        return this.el;
    }
    /**
     * Returns the target for the step
     * @return The element instance. undefined if it has never been shown, null if query string has not been found
     */
    getTarget() {
        return this.target;
    }
    /**
     * Creates Shepherd element for step based on options
     *
     * @return {Element} The DOM element for the step tooltip
     * @private
     */
    _createTooltipContent() {
        const descriptionId = `${this.id}-description`;
        const labelId = `${this.id}-label`;
        // @ts-expect-error TODO: get types for Svelte components
        this.shepherdElementComponent = new Shepherd_element({
            target: this.tour.options.stepsContainer || document.body,
            props: {
                classPrefix: this.classPrefix,
                descriptionId,
                labelId,
                step: this,
                // @ts-expect-error TODO: investigate where styles comes from
                styles: this.styles
            }
        });
        // @ts-expect-error TODO: get types for Svelte components
        return this.shepherdElementComponent.getElement();
    }
    /**
     * If a custom scrollToHandler is defined, call that, otherwise do the generic
     * scrollIntoView call.
     *
     * @param scrollToOptions - If true, uses the default `scrollIntoView`,
     * if an object, passes that object as the params to `scrollIntoView` i.e. `{ behavior: 'smooth', block: 'center' }`
     * @private
     */
    _scrollTo(scrollToOptions) {
        const { element } = this._getResolvedAttachToOptions();
        if (isFunction(this.options.scrollToHandler)) {
            this.options.scrollToHandler(element);
        }
        else if (isElement(element) &&
            typeof element.scrollIntoView === 'function') {
            element.scrollIntoView(scrollToOptions);
        }
    }
    /**
     * _getClassOptions gets all possible classes for the step
     * @param stepOptions The step specific options
     * @returns unique string from array of classes
     */
    _getClassOptions(stepOptions) {
        const defaultStepOptions = this.tour && this.tour.options && this.tour.options.defaultStepOptions;
        const stepClasses = stepOptions.classes ? stepOptions.classes : '';
        const defaultStepOptionsClasses = defaultStepOptions && defaultStepOptions.classes
            ? defaultStepOptions.classes
            : '';
        const allClasses = [
            ...stepClasses.split(' '),
            ...defaultStepOptionsClasses.split(' ')
        ];
        const uniqClasses = new Set(allClasses);
        return Array.from(uniqClasses).join(' ').trim();
    }
    /**
     * Sets the options for the step, maps `when` to events, sets up buttons
     * @param options - The options for the step
     */
    _setOptions(options = {}) {
        let tourOptions = this.tour && this.tour.options && this.tour.options.defaultStepOptions;
        tourOptions = deepmerge({}, tourOptions || {});
        this.options = Object.assign({
            arrow: true
        }, tourOptions, options, mergeTooltipConfig(tourOptions, options));
        const { when } = this.options;
        this.options.classes = this._getClassOptions(options);
        this.destroy();
        this.id = this.options.id || `step-${uuid()}`;
        if (when) {
            Object.keys(when).forEach((event) => {
                // @ts-expect-error TODO: fix this type error
                this.on(event, when[event], this);
            });
        }
    }
    /**
     * Create the element and set up the FloatingUI instance
     * @private
     */
    _setupElements() {
        if (!isUndefined(this.el)) {
            this.destroy();
        }
        this.el = this._createTooltipContent();
        if (this.options.advanceOn) {
            bindAdvance(this);
        }
        // The tooltip implementation details are handled outside of the Step
        // object.
        setupTooltip(this);
    }
    /**
     * Triggers `before-show`, generates the tooltip DOM content,
     * sets up a FloatingUI instance for the tooltip, then triggers `show`.
     * @private
     */
    _show() {
        this.trigger('before-show');
        // Force resolve to make sure the options are updated on subsequent shows.
        this._resolveAttachToOptions();
        this._setupElements();
        if (!this.tour.modal) {
            this.tour.setupModal();
        }
        this.tour.modal?.setupForStep(this);
        this._styleTargetElementForStep(this);
        if (this.el) {
            this.el.hidden = false;
        }
        // start scrolling to target before showing the step
        if (this.options.scrollTo) {
            setTimeout(() => {
                this._scrollTo(this.options.scrollTo);
            });
        }
        if (this.el) {
            this.el.hidden = false;
        }
        // @ts-expect-error TODO: get types for Svelte components
        const content = this.shepherdElementComponent.getElement();
        const target = this.target || document.body;
        target.classList.add(`${this.classPrefix}shepherd-enabled`);
        target.classList.add(`${this.classPrefix}shepherd-target`);
        content.classList.add('shepherd-enabled');
        this.trigger('show');
    }
    /**
     * Modulates the styles of the passed step's target element, based on the step's options and
     * the tour's `modal` option, to visually emphasize the element
     *
     * @param step The step object that attaches to the element
     * @private
     */
    _styleTargetElementForStep(step) {
        const targetElement = step.target;
        if (!targetElement) {
            return;
        }
        if (step.options.highlightClass) {
            targetElement.classList.add(step.options.highlightClass);
        }
        targetElement.classList.remove('shepherd-target-click-disabled');
        if (step.options.canClickTarget === false) {
            targetElement.classList.add('shepherd-target-click-disabled');
        }
    }
    /**
     * When a step is hidden, remove the highlightClass and 'shepherd-enabled'
     * and 'shepherd-target' classes
     * @private
     */
    _updateStepTargetOnHide() {
        const target = this.target || document.body;
        if (this.options.highlightClass) {
            target.classList.remove(this.options.highlightClass);
        }
        target.classList.remove('shepherd-target-click-disabled', `${this.classPrefix}shepherd-enabled`, `${this.classPrefix}shepherd-target`);
    }
}

export { Step as S, SvelteComponent as a, svg_element as b, attr as c, insert as d, append as e, detach as f, binding_callbacks as g, init as i, listen as l, noop as n, safe_not_equal as s };
//# sourceMappingURL=step-l4hu7HrB.js.map
