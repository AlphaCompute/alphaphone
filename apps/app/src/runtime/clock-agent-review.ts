import {registerPlugin} from '../platform-plugins';
import {createClockReviewExecutor,type ClockReviewBridge} from '../../../../patches/eliza/exports/clock-review-executor';
// One owner-retirement registry for this renderer; native approval remains in AlphaActionJournal.
const executor=createClockReviewExecutor(registerPlugin<ClockReviewBridge>('AlphaActionJournal'));
export const retireClockReviews=executor.retire;
export const reviewAgentClock=executor.review;
