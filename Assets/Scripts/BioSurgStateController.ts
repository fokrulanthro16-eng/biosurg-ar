/**
 * BioSurg AR v3.0 - Snap SPECS Lens Studio Script Controller
 * Path: /Assets/Scripts/BioSurgStateController.ts
 * Deterministic Finite State Machine (FSM) & CLAD/MCP Spatial Controller
 */

export enum BioSurgFSMState {
  BOOT_CALIBRATION = 'BOOT_CALIBRATION',
  ANATOMY_SCAN = 'ANATOMY_SCAN',
  NIR_HYPOXIA_MAPPING = 'NIR_HYPOXIA_MAPPING',
  CANNULA_TRACKING = 'CANNULA_TRACKING',
  EXPLODED_DISSECTION = 'EXPLODED_DISSECTION',
  LUMEN_CANULATION = 'LUMEN_CANULATION',
  HEMODYNAMIC_RESTORE = 'HEMODYNAMIC_RESTORE',
  POST_OP_AUDIT = 'POST_OP_AUDIT'
}

export interface CLADEvent {
  eventId: string;
  timestampMs: number;
  fromState: BioSurgFSMState;
  toState: BioSurgFSMState;
  spatialAnchorLocked: boolean;
  waveguideOcclusionPercent: number;
  trackingLatencyMs: number;
}

export class BioSurgStateController {
  private currentState: BioSurgFSMState = BioSurgFSMState.BOOT_CALIBRATION;
  private transitionLog: CLADEvent[] = [];
  private isSpatialLocked = true;
  private waveguideOcclusion = 5.4; // 5.4% FOV occlusion
  private trackingLatency = 12.0; // 12ms motion-to-photon

  constructor() {
    this.logTransition(BioSurgFSMState.BOOT_CALIBRATION, BioSurgFSMState.BOOT_CALIBRATION);
  }

  public getCurrentState(): BioSurgFSMState {
    return this.currentState;
  }

  public getTransitionLog(): CLADEvent[] {
    return this.transitionLog;
  }

  /**
   * Deterministic transition function satisfying LEAF-12 criteria
   */
  public transition(targetState: BioSurgFSMState): boolean {
    const validMap: Record<BioSurgFSMState, BioSurgFSMState[]> = {
      [BioSurgFSMState.BOOT_CALIBRATION]: [BioSurgFSMState.ANATOMY_SCAN],
      [BioSurgFSMState.ANATOMY_SCAN]: [BioSurgFSMState.NIR_HYPOXIA_MAPPING, BioSurgFSMState.BOOT_CALIBRATION],
      [BioSurgFSMState.NIR_HYPOXIA_MAPPING]: [BioSurgFSMState.CANNULA_TRACKING, BioSurgFSMState.ANATOMY_SCAN],
      [BioSurgFSMState.CANNULA_TRACKING]: [BioSurgFSMState.EXPLODED_DISSECTION, BioSurgFSMState.NIR_HYPOXIA_MAPPING],
      [BioSurgFSMState.EXPLODED_DISSECTION]: [BioSurgFSMState.LUMEN_CANULATION, BioSurgFSMState.CANNULA_TRACKING],
      [BioSurgFSMState.LUMEN_CANULATION]: [BioSurgFSMState.HEMODYNAMIC_RESTORE, BioSurgFSMState.EXPLODED_DISSECTION],
      [BioSurgFSMState.HEMODYNAMIC_RESTORE]: [BioSurgFSMState.POST_OP_AUDIT, BioSurgFSMState.LUMEN_CANULATION],
      [BioSurgFSMState.POST_OP_AUDIT]: [BioSurgFSMState.BOOT_CALIBRATION]
    };

    const allowed = validMap[this.currentState];
    if (!allowed || !allowed.includes(targetState)) {
      return false;
    }

    const previous = this.currentState;
    this.currentState = targetState;
    this.logTransition(previous, targetState);
    return true;
  }

  private logTransition(from: BioSurgFSMState, to: BioSurgFSMState): void {
    const evt: CLADEvent = {
      eventId: `CLAD_EVT_0x${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`,
      timestampMs: Date.now(),
      fromState: from,
      toState: to,
      spatialAnchorLocked: this.isSpatialLocked,
      waveguideOcclusionPercent: this.waveguideOcclusion,
      trackingLatencyMs: this.trackingLatency
    };
    this.transitionLog.push(evt);
  }
}
