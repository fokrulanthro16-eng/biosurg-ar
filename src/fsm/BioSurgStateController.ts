/**
 * BioSurg AR v3.0 - Finite State Machine (FSM) State Controller
 * Deterministic CLAD & MCP spatial state transitions for Snap SPECS
 */

export enum BioSurgState {
  BOOT_CALIBRATION = 'BOOT_CALIBRATION',
  ANATOMY_SCAN = 'ANATOMY_SCAN',
  NIR_HYPOXIA_MAPPING = 'NIR_HYPOXIA_MAPPING',
  CANNULA_TRACKING = 'CANNULA_TRACKING',
  EXPLODED_DISSECTION = 'EXPLODED_DISSECTION',
  LUMEN_CANULATION = 'LUMEN_CANULATION',
  HEMODYNAMIC_RESTORE = 'HEMODYNAMIC_RESTORE',
  POST_OP_AUDIT = 'POST_OP_AUDIT'
}

export interface StateTransitionEvent {
  fromState: BioSurgState;
  toState: BioSurgState;
  timestampMs: number;
  cladEventId: string;
  mcpContextPayload: Record<string, unknown>;
}

export type StateChangeCallback = (event: StateTransitionEvent) => void;

export class BioSurgStateController {
  private currentState: BioSurgState = BioSurgState.BOOT_CALIBRATION;
  private stateHistory: StateTransitionEvent[] = [];
  private listeners: StateChangeCallback[] = [];

  // State order for automated sequence
  private stateSequence: BioSurgState[] = [
    BioSurgState.BOOT_CALIBRATION,
    BioSurgState.ANATOMY_SCAN,
    BioSurgState.NIR_HYPOXIA_MAPPING,
    BioSurgState.CANNULA_TRACKING,
    BioSurgState.EXPLODED_DISSECTION,
    BioSurgState.LUMEN_CANULATION,
    BioSurgState.HEMODYNAMIC_RESTORE,
    BioSurgState.POST_OP_AUDIT
  ];

  constructor() {
    this.recordInitialState();
  }

  private recordInitialState(): void {
    this.stateHistory.push({
      fromState: BioSurgState.BOOT_CALIBRATION,
      toState: BioSurgState.BOOT_CALIBRATION,
      timestampMs: performance.now(),
      cladEventId: `CLAD_EVT_0x${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`,
      mcpContextPayload: {
        agent: 'SnapSpecsNeuralAgent',
        waveguideOcclusion: '5.4%',
        quantumLock: '99.9%'
      }
    });
  }

  public getState(): BioSurgState {
    return this.currentState;
  }

  public getHistory(): StateTransitionEvent[] {
    return [...this.stateHistory];
  }

  public addStateListener(listener: StateChangeCallback): void {
    this.listeners.push(listener);
  }

  public transitionTo(nextState: BioSurgState, extraContext: Record<string, unknown> = {}): boolean {
    if (this.currentState === nextState) return false;

    // Validate deterministic transitions
    const validTransitions: Record<BioSurgState, BioSurgState[]> = {
      [BioSurgState.BOOT_CALIBRATION]: [BioSurgState.ANATOMY_SCAN],
      [BioSurgState.ANATOMY_SCAN]: [BioSurgState.NIR_HYPOXIA_MAPPING, BioSurgState.BOOT_CALIBRATION],
      [BioSurgState.NIR_HYPOXIA_MAPPING]: [BioSurgState.CANNULA_TRACKING, BioSurgState.ANATOMY_SCAN],
      [BioSurgState.CANNULA_TRACKING]: [BioSurgState.EXPLODED_DISSECTION, BioSurgState.NIR_HYPOXIA_MAPPING],
      [BioSurgState.EXPLODED_DISSECTION]: [BioSurgState.LUMEN_CANULATION, BioSurgState.CANNULA_TRACKING],
      [BioSurgState.LUMEN_CANULATION]: [BioSurgState.HEMODYNAMIC_RESTORE, BioSurgState.EXPLODED_DISSECTION],
      [BioSurgState.HEMODYNAMIC_RESTORE]: [BioSurgState.POST_OP_AUDIT, BioSurgState.LUMEN_CANULATION],
      [BioSurgState.POST_OP_AUDIT]: [BioSurgState.BOOT_CALIBRATION]
    };

    const allowed = validTransitions[this.currentState]?.includes(nextState);
    if (!allowed) {
      console.warn(`[BioSurgStateController] Transition from ${this.currentState} to ${nextState} bypassed check for direct UI trigger.`);
    }

    const previous = this.currentState;
    this.currentState = nextState;

    const event: StateTransitionEvent = {
      fromState: previous,
      toState: nextState,
      timestampMs: performance.now(),
      cladEventId: `CLAD_EVT_0x${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`,
      mcpContextPayload: {
        timestampIso: new Date().toISOString(),
        currentState: nextState,
        ...extraContext
      }
    };

    this.stateHistory.push(event);
    this.listeners.forEach(cb => cb(event));
    return true;
  }

  public nextState(): BioSurgState {
    const currentIndex = this.stateSequence.indexOf(this.currentState);
    const nextIndex = (currentIndex + 1) % this.stateSequence.length;
    const next = this.stateSequence[nextIndex];
    this.transitionTo(next);
    return next;
  }

  public reset(): void {
    this.transitionTo(BioSurgState.BOOT_CALIBRATION);
  }
}
