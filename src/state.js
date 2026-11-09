export const STAGE_IDS = ['greeting', 'need', 'osago', 'mini', 'finish'];

export function createState(mode = 'novice') {
  return {
    mode: mode === 'expert' ? 'expert' : 'novice',
    stageIndex: 0,
    maxReached: 0,
    need: null,
    miniDecision: null,
    outcome: null,
    notice: null,
    detailsOpen: false,
    objectionOpen: false,
    selectedObjection: null
  };
}

export function transition(state, action, value = null) {
  const next = { ...state };

  if (action === 'mode') {
    next.mode = value === 'expert' ? 'expert' : 'novice';
    return next;
  }
  if (action === 'objections') {
    next.objectionOpen = true;
    next.selectedObjection ??= 'expensive';
    return next;
  }
  if (action === 'selectObjection' && state.objectionOpen) {
    next.selectedObjection = value;
    return next;
  }
  if (action === 'closeObjections') {
    next.objectionOpen = false;
    return next;
  }
  if (action === 'restart') return createState(state.mode);
  if (action === 'back' && state.stageIndex > 0) {
    next.stageIndex -= 1;
    next.notice = null;
    return next;
  }
  if (action === 'stage') {
    const index = Number(value);
    if (Number.isInteger(index) && index >= 0 && index <= state.maxReached) {
      next.stageIndex = index;
      next.notice = null;
    }
    return next;
  }

  const advance = () => {
    next.stageIndex += 1;
    next.maxReached = Math.max(next.maxReached, next.stageIndex);
    next.notice = null;
    next.detailsOpen = false;
  };

  switch (STAGE_IDS[state.stageIndex]) {
    case 'greeting':
      if (action === 'convenient') advance();
      if (action === 'inconvenient') next.notice = 'callback';
      break;
    case 'need':
      if (action === 'onlyOsago' || action === 'extraProtection') {
        next.need = action;
        advance();
      }
      if (action === 'difference') next.notice = 'difference';
      break;
    case 'osago':
      if (action === 'toMini') advance();
      break;
    case 'mini':
      if (action === 'miniYes' || action === 'miniNo') {
        next.miniDecision = action;
        next.notice = action;
        next.detailsOpen = false;
      }
      if (action === 'miniDetails') next.detailsOpen = !state.detailsOpen;
      if (action === 'toFinish') advance();
      break;
    case 'finish':
      if (['ready', 'calculation', 'declined'].includes(action)) next.outcome = action;
      break;
  }
  return next;
}
