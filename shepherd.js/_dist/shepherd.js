/*! shepherd.js 12.0.0-alpha.3 */

import { Shepherd, Tour } from './tour.js';
import { NoOp } from './utils/general.js';
import { S as Step } from './step-l4hu7HrB.js';
import './evented.js';
import './utils/type-check.js';
import './utils/auto-bind.js';
import './utils/cleanup.js';
import './utils/datarequest.js';
import './utils/overlay-path.js';
import './floating-ui-CG42dGZ2.js';
import './utils/bind.js';

const isServerSide = typeof window === 'undefined';
Shepherd.Step = isServerSide ? NoOp : Step;
Shepherd.Tour = isServerSide ? NoOp : Tour;

export { Shepherd as default };
//# sourceMappingURL=shepherd.js.map
