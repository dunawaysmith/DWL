import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { SIK } from "SpectaclesInteractionKit.lspkg/SIK";
import { LSTween } from "LSTween.lspkg/LSTween";
import Easing from "LSTween.lspkg/TweenJS/Easing";

@component
export class WinterStarController extends BaseScriptComponent {
  // --- Start Menu ---
  @input startMenu: SceneObject;
  @input startButton: Interactable;
  @input startMenuHideSeconds: number = 0.5;

  // Star
  @input winterStarContainer: SceneObject;
  @input winterStarHolder: SceneObject;
  @input fragment1: SceneObject;
  @input fragment2: SceneObject;
  @input fragment3: SceneObject;
  @input starAnimObjects: SceneObject[] = []; // spikes-tall, spikes-small, rings, chevrons, SFanim, RLanim
  @input haloCompleteMaterial: Material;
  @input starBorder: SceneObject;
  @input starBorderMaterial: Material;
  @input windAnimation: SceneObject;
  @input windFadeInDuration: number = 1.0;
  @input windVisibleDuration: number = 5.0;
  @input windFadeOutDuration: number = 1.0;
  @input haloRotationDuration: number = 10.0;
  @input haloFadeDuration: number = 1.0;

  // 2D animated materials
  @input snowflakeAnimMaterial: Material;
  @input radiatingLineMaterial: Material;
  @input anim2DFadeSeconds: number = 0.5;

  // Tree
  @input christmasTree: SceneObject;
  @input starParticlesLeft: SceneObject;
  @input starParticlesRight: SceneObject;

  // Ornaments
  @input ornaments: SceneObject[] = [];
  @input ornamentScaleInDuration: number = 0.5;
  @input ornamentScaleInDelayMin: number = 0.0;
  @input ornamentScaleInDelayMax: number = 3.0;
  @input ornamentStartDelay: number = 0.0;

  // Landscape
  @input landscapeElements: SceneObject[] = [];
  @input landscapeScaleInDuration: number = 2.0;
  @input landscapeScaleInDelayMin: number = 0.0;
  @input landscapeScaleInDelayMax: number = 2.0;
  @input landscapeStartDelay: number = 0.0;

  // UI
  @input instructionText: Text;
  @input uiComp: SceneObject;
  @input pinchUIHand: SceneObject;
  @input uiFadeInSeconds: number = 0.35;
  @input uiHoldSeconds: number = 2.0;
  @input uiFadeOutSeconds: number = 0.35;

  // Star Descent
  @input descentDistance: number = 0.3;
  @input descentDuration: number = 5.0;
  @input descentStartScale: number = 0.0;
  @input descentEndScale: number = 0.05;

  // Explosion / Collect
  @input explosionDistance: number = 0.5;
  @input explosionDuration: number = 1.0;
  @input collectDuration: number = 0.8;

  // Unification
  @input unificationRiseDistance: number = 0.6;
  @input unificationRiseDuration: number = 3.0;
  @input treeAnimationDuration: number = 3.0;
  @input snowParticles: SceneObject;

  // Failsafe
  @input failsafeTimeout: number = 120.0;

  // Audio
  @input soundtrackAudio: AudioComponent;
  @input windSound: AudioComponent;
  @input explosionSound: AudioComponent;
  @input collectedSound: AudioComponent;
  @input unificationSound: AudioComponent;

  // State
  private readonly States = {
    DESCENDING: "descending",
    WIND_BLOWING: "wind_blowing",
    EXPLODING: "exploding",
    COLLECTING: "collecting",
    UNIFYING: "unifying",
    COMPLETE: "complete",
  };

  private currentState = this.States.DESCENDING;
  private fragmentsCollected = 0;
  private fragmentData: FragmentData[] = [];
  private failsafeTimer: DelayedCallbackEvent | null = null;

  // UI fade state
  private uiFadeUpdateEvt: UpdateEvent | null = null;
  private uiPhase: "in" | "hold" | "out" | null = null;
  private uiPhaseStartTime = 0;
  private uiPhaseDuration = 0;
  private uiCurrentTag: string | undefined;
  private uiHoldDelayEvt: DelayedCallbackEvent | null = null;

  // Cached anim players
  private cachedStarPlayers: AnimationPlayer[] | null = null;

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.init());
  }

  private init(): void {
    if (!this.winterStarHolder) { print("ERROR: winterStarHolder not assigned"); return; }

    this.setupFragments();
    this.setupInteractions();
    this.setupStartButton();

    if (this.soundtrackAudio) this.soundtrackAudio.play(-1);
    if (this.uiComp) this.uiComp.enabled = false;
    if (this.pinchUIHand) this.pinchUIHand.enabled = false;
    if (this.windAnimation) this.windAnimation.enabled = false;
    if (this.starParticlesLeft) this.starParticlesLeft.enabled = false;
    if (this.starParticlesRight) this.starParticlesRight.enabled = false;
    if (this.snowParticles) this.snowParticles.enabled = false;

    const hide = (arr: SceneObject[]) => arr && arr.forEach(e => e && (e.enabled = false));
    hide(this.ornaments);
    hide(this.landscapeElements);

    if (this.winterStarHolder) this.winterStarHolder.enabled = false;
    if (this.startMenu) this.startMenu.enabled = true;

    this.ensureUIFadeUpdate();
  }

  private setupStartButton(): void {
    if (!this.startButton || !this.startMenu) {
      print("WinterStarController: start button or menu not assigned — starting immediately.");
      this.startStarSequence();
      return;
    }
    this.startMenu.enabled = true;
    this.startButton.enabled = true;
    this.startButton.onTriggerEnd.add(() => this.onStartPressed());
  }

  private onStartPressed(): void {
    if (!this.startMenu) { this.startStarSequence(); return; }
    if (this.startButton) this.startButton.enabled = false;

    const tr = this.startMenu.getTransform();
    LSTween.scaleToLocal(tr, vec3.zero(), this.startMenuHideSeconds * 1000)
      .easing(Easing.Quadratic.In)
      .onComplete(() => {
        this.startMenu.enabled = false;
        this.startStarSequence();
      })
      .start();
  }

  private startStarSequence(): void {
    if (this.winterStarContainer) this.winterStarContainer.enabled = true;
    this.startStarDescent();
  }

  private setupFragments(): void {
    this.fragmentData = [
      { sceneObject: this.fragment1, name: "fragment1", direction: new vec3(0, 0.5, -0.3), collected: false, originalPosition: vec3.zero(), originalLocalPosition: vec3.zero(), interactable: null },
      { sceneObject: this.fragment2, name: "fragment2", direction: new vec3(-0.6, -0.2, -0.2), collected: false, originalPosition: vec3.zero(), originalLocalPosition: vec3.zero(), interactable: null },
      { sceneObject: this.fragment3, name: "fragment3", direction: new vec3(0.6, -0.2, -0.2), collected: false, originalPosition: vec3.zero(), originalLocalPosition: vec3.zero(), interactable: null },
    ];

    this.fragmentData.forEach(f => {
      const itx = f.sceneObject.getComponent(Interactable.getTypeName()) as Interactable;
      if (!itx) print(`ERROR: No Interactable on ${f.name}`);
      f.interactable = itx || null;
    });
  }

  private setupInteractions(): void {
    this.fragmentData.forEach((f, i) => {
      if (!f.interactable) return;
      f.interactable.onTriggerEnd.add(() => this.onFragmentSelected(i));
    });
  }

  // Anim players under starAnimObjects
  private getAllAnimationPlayersUnder(objs: SceneObject[]): AnimationPlayer[] {
    const result: AnimationPlayer[] = [];
    const visit = (so: SceneObject) => {
      if (!so) return;
      const ap = so.getComponent("Component.AnimationPlayer") as AnimationPlayer;
      if (ap) result.push(ap);
      const n = so.getChildrenCount();
      for (let i = 0; i < n; i++) {
        const c = so.getChild(i);
        if (c) visit(c);
      }
    };
    objs?.forEach(o => o && visit(o));
    return result;
  }
  private ensureStarPlayersCached(): void {
    if (!this.cachedStarPlayers) {
      this.cachedStarPlayers = this.getAllAnimationPlayersUnder(this.starAnimObjects || []);
      print(`WinterStarController: cached ${this.cachedStarPlayers.length} star AnimationPlayers`);
    }
  }
  private pauseStarAnims(): void {
    this.ensureStarPlayersCached();
    this.cachedStarPlayers!.forEach(p => p.pauseAll && p.pauseAll());
  }
  private resumeStarAnims(): void {
    this.ensureStarPlayersCached();
    this.cachedStarPlayers!.forEach(p => {
      if (p.resumeAll) p.resumeAll(); else if (p.playAll) p.playAll();
    });
  }

  // --- Core sequences ---
  private startStarDescent(): void {
    this.currentState = this.States.DESCENDING;
    if (!this.winterStarHolder) { print("ERROR: winterStarHolder not assigned"); return; }

    this.winterStarHolder.enabled = true;

    const transform = this.winterStarHolder.getTransform();
    const startPos = transform.getLocalPosition();
    const targetPos = new vec3(startPos.x, startPos.y - this.descentDistance, startPos.z);

    LSTween.moveToLocal(transform, targetPos, this.descentDuration * 1000)
      .easing(Easing.Quadratic.InOut)
      .onComplete(() => {
        this.storeFragmentPositions();
        this.triggerWind();
      })
      .start();

    const startScale = new vec3(this.descentStartScale, this.descentStartScale, this.descentStartScale);
    const endScale = new vec3(this.descentEndScale, this.descentEndScale, this.descentEndScale);
    transform.setLocalScale(startScale);
    LSTween.scaleToLocal(transform, endScale, this.descentDuration * 1000).easing(Easing.Quadratic.Out).start();
  }

  private storeFragmentPositions(): void {
    this.fragmentData.forEach(f => {
      const tr = f.sceneObject.getTransform();
      f.originalPosition = tr.getWorldPosition();
      f.originalLocalPosition = tr.getLocalPosition(); // use local for return
    });
  }

  private triggerWind(): void {
    this.currentState = this.States.WIND_BLOWING;

    if (this.windSound) this.windSound.play(1);

    if (this.windAnimation) {
      this.windAnimation.enabled = true;
      const img = this.windAnimation.getComponent("Component.Image") as Image;
      if (img) {
        const ctl = img.getMaterial(0).getPass(0).baseTex.control as AnimatedTextureFileProvider;
        if (ctl) ctl.play(1, 0);
      }
      this.fadeSceneObject(this.windAnimation, 0, 1, this.windFadeInDuration, () => {
        const outEvt = this.createEvent("DelayedCallbackEvent");
        outEvt.bind(() => {
          this.fadeSceneObject(this.windAnimation, 1, 0, this.windFadeOutDuration, () => {
            if (this.windAnimation) this.windAnimation.enabled = false;
          });
        });
        outEvt.reset(this.windVisibleDuration);
      });
    }

    const delay = this.createEvent("DelayedCallbackEvent");
    delay.bind(() => {
      this.showUI("The Winter Star\nhas been shattered!", "shattered");
      this.explodeFragments();
    });
    delay.reset(this.windFadeInDuration);
  }

  private explodeFragments(): void {
    this.currentState = this.States.EXPLODING;

    this.pauseStarAnims();

    if (this.explosionSound) this.explosionSound.play(1);
    if (this.haloCompleteMaterial) LSTween.alphaTo(this.haloCompleteMaterial, 0, this.haloFadeDuration).start();
    if (this.starBorderMaterial) LSTween.alphaTo(this.starBorderMaterial, 0.2, this.haloFadeDuration).start();

    // fade/stop animated 2D materials
    this.fadeAndStopAnimatedMaterial(this.snowflakeAnimMaterial, 0, this.anim2DFadeSeconds);
    this.fadeAndStopAnimatedMaterial(this.radiatingLineMaterial, 0, this.anim2DFadeSeconds);

    this.fragmentData.forEach(f => {
      const tr = f.sceneObject.getTransform();
      const start = tr.getWorldPosition();
      const target = start.add(f.direction.uniformScale(this.explosionDistance));
      LSTween.moveToWorld(tr, target, this.explosionDuration * 1000).easing(Easing.Quadratic.Out).start();
    });

    const toCollect = this.createEvent("DelayedCallbackEvent");
    toCollect.bind(() => this.startCollecting());
    toCollect.reset(this.explosionDuration);
  }

  private startCollecting(): void {
    this.currentState = this.States.COLLECTING;
    this.showUI("Bring it back to life by\ncollecting the fragments", "collect_intro");
    this.startFailsafeTimer();
  }

  private onFragmentSelected(i: number): void {
    if (this.currentState !== this.States.COLLECTING) return;
    const f = this.fragmentData[i];
    if (f.collected) return;

    if (this.collectedSound) this.collectedSound.play(1);
    f.collected = true;
    this.fragmentsCollected++;
    if (f.interactable) f.interactable.enabled = false;
    this.animateFragmentReturn(f);

    if (this.fragmentsCollected >= this.fragmentData.length) {
      if (this.failsafeTimer) { this.removeEvent(this.failsafeTimer); this.failsafeTimer = null; }
      const evt = this.createEvent("DelayedCallbackEvent");
      evt.bind(() => this.startUnification());
      evt.reset(this.collectDuration + 0.05); // wait for last return tween
    } else {
      const remaining = this.fragmentData.length - this.fragmentsCollected;
      this.showUI(`${remaining} fragment${remaining > 1 ? "s" : ""} remaining...`, "remaining", 1.2);
    }
  }

  private animateFragmentReturn(f: FragmentData): void {
    const tr = f.sceneObject.getTransform();
    LSTween.moveToLocal(tr, f.originalLocalPosition, this.collectDuration * 1000).easing(Easing.Cubic.InOut).start();
  }

  private startFailsafeTimer(): void {
    this.failsafeTimer = this.createEvent("DelayedCallbackEvent");
    this.failsafeTimer.bind(() => this.onFailsafeTriggered());
    this.failsafeTimer.reset(this.failsafeTimeout);
  }

  private onFailsafeTriggered(): void {
    if (this.currentState !== this.States.COLLECTING) return;
    this.fragmentData.forEach(f => {
      if (f.collected) return;
      f.collected = true;
      this.fragmentsCollected++;
      if (f.interactable) f.interactable.enabled = false;
      this.animateFragmentReturn(f);
    });
    const evt = this.createEvent("DelayedCallbackEvent");
    evt.bind(() => this.startUnification());
    evt.reset(this.collectDuration + 0.5);
  }

  private startUnification(): void {
    this.currentState = this.States.UNIFYING;

    this.resumeStarAnims();

    if (this.unificationSound) this.unificationSound.play(1);
    if (this.haloCompleteMaterial) LSTween.alphaTo(this.haloCompleteMaterial, 1, this.haloFadeDuration).start();
    if (this.starBorderMaterial) LSTween.alphaTo(this.starBorderMaterial, 1, this.haloFadeDuration).start();

    // fade-in + play animated 2D materials
    this.fadeInAndPlayAnimatedMaterial(this.snowflakeAnimMaterial, 1, this.anim2DFadeSeconds, -1);
    this.fadeInAndPlayAnimatedMaterial(this.radiatingLineMaterial, 1, this.anim2DFadeSeconds, -1);

    this.showUI("The Winter Star\nburns bright again!", "unify_bright");

    const t = this.winterStarHolder.getTransform();
    const p0 = t.getLocalPosition();
    const p1 = new vec3(p0.x, p0.y + this.unificationRiseDistance, p0.z);
    LSTween.moveToLocal(t, p1, this.unificationRiseDuration * 1000).easing(Easing.Quadratic.InOut).start();

    this.animateChristmasTree();
    this.animateOrnaments();
    this.animateLandscapeElements();
    if (this.snowParticles) this.snowParticles.enabled = true;

    const doneEvt = this.createEvent("DelayedCallbackEvent");
    doneEvt.bind(() => this.completeExperience());
    doneEvt.reset(this.unificationRiseDuration + 1.0);
  }

  private animateChristmasTree(): void {
    if (!this.christmasTree) return;
    this.christmasTree.enabled = true;
  }

  private animateOrnaments(): void {
    if (!this.ornaments || this.ornaments.length === 0) return;
    this.ornaments.forEach(o => {
      if (!o) return;
      const d = this.ornamentScaleInDelayMin + Math.random() * (this.ornamentScaleInDelayMax - this.ornamentScaleInDelayMin);
      const total = this.ornamentStartDelay + d;
      const evt = this.createEvent("DelayedCallbackEvent");
      evt.bind(() => {
        o.enabled = true;
        const tr = o.getTransform();
        LSTween.scaleFromToLocal(tr, new vec3(0.01, 0.01, 0.01), new vec3(1, 1, 1), this.ornamentScaleInDuration * 1000)
          .easing(Easing.Back.Out)
          .start();
      });
      evt.reset(total);
    });
  }

  private animateLandscapeElements(): void {
    if (!this.landscapeElements || this.landscapeElements.length === 0) return;
    this.landscapeElements.forEach(e => {
      if (!e) return;
      const d = this.landscapeScaleInDelayMin + Math.random() * (this.landscapeScaleInDelayMax - this.landscapeScaleInDelayMin);
      const total = this.landscapeStartDelay + d;
      const evt = this.createEvent("DelayedCallbackEvent");
      evt.bind(() => {
        e.enabled = true;
        const tr = e.getTransform();
        LSTween.scaleFromToLocal(tr, new vec3(0.01, 0.01, 0.01), new vec3(1, 1, 1), this.landscapeScaleInDuration * 1000)
          .easing(Easing.Quadratic.InOut)
          .start();
      });
      evt.reset(total);
    });
  }

  private completeExperience(): void {
    this.currentState = this.States.COMPLETE;
    if (this.starParticlesLeft) this.starParticlesLeft.enabled = true;
    if (this.starParticlesRight) this.starParticlesRight.enabled = true;
    this.showUI("Move your hand.\nYou are a star\nbearer now.", "final", 2.0);
  }

  // UI fade
  private ensureUIFadeUpdate() {
    if (this.uiFadeUpdateEvt) return;
    this.uiFadeUpdateEvt = this.createEvent("UpdateEvent");
    this.uiFadeUpdateEvt.enabled = true;
    this.uiFadeUpdateEvt.bind(() => this.onUIFadeUpdate());
  }

  private showUI(message: string, tag?: string, holdSeconds?: number, showPinchHand?: boolean) {
    if (!this.instructionText) { print(message); return; }
    if (this.pinchUIHand) this.pinchUIHand.enabled = !!showPinchHand;
    if (this.uiComp) this.uiComp.enabled = true; else this.instructionText.getSceneObject().enabled = true;
    this.cancelUIAnimation();
    this.instructionText.text = message;
    const tf = this.instructionText.textFill;
    tf.color = new vec4(tf.color.r, tf.color.g, tf.color.b, 0);
    this.uiCurrentTag = tag;
    this.startUIPhase("in", this.uiFadeInSeconds);
    const hold = typeof holdSeconds === "number" ? holdSeconds : this.uiHoldSeconds;
    this.uiHoldDelayEvt = this.createEvent("DelayedCallbackEvent");
    this.uiHoldDelayEvt.bind(() => { this.startUIPhase("out", this.uiFadeOutSeconds); });
    this.uiHoldDelayEvt.reset(this.uiFadeInSeconds + hold);
  }

  private startUIPhase(phase: "in" | "hold" | "out", duration: number) {
    this.uiPhase = phase;
    this.uiPhaseStartTime = getTime();
    this.uiPhaseDuration = Math.max(0.0001, duration);
  }

  private onUIFadeUpdate() {
    if (!this.uiPhase || !this.instructionText) return;
    const t = getTime() - this.uiPhaseStartTime;
    const k = Math.min(1, t / this.uiPhaseDuration);
    const tf = this.instructionText.textFill;
    const col = tf.color;
    if (this.uiPhase === "in") {
      tf.color = new vec4(col.r, col.g, col.b, k);
      if (k >= 1) this.startUIPhase("hold", 0.0001);
    } else if (this.uiPhase === "out") {
      tf.color = new vec4(col.r, col.g, col.b, 1 - k);
      if (k >= 1) this.onUIFadeComplete();
    }
  }

  private onUIFadeComplete() {
    this.uiPhase = null;
    if (this.uiComp) this.uiComp.enabled = false;
    if (this.pinchUIHand) this.pinchUIHand.enabled = false;
    const tag = this.uiCurrentTag;
    this.uiCurrentTag = undefined;
    this.onUIMessageComplete(tag);
  }

  private cancelUIAnimation() {
    if (this.uiHoldDelayEvt) { this.removeEvent(this.uiHoldDelayEvt); this.uiHoldDelayEvt = null; }
    this.uiPhase = null;
    this.uiCurrentTag = undefined;
  }

  private onUIMessageComplete(tag?: string) {
    if (tag === "collect_intro") {
      this.showUI("Pinch to select\nthe star fragments.", "pinch", 1.6, true);
    }
  }

  // Material fades for 2D animated textures
  private fadeAndStopAnimatedMaterial(mat: Material | null, toAlpha: number, durSec: number): void {
    if (!mat) return;
    LSTween.alphaTo(mat, toAlpha, durSec)
      .onComplete(() => {
        if (toAlpha <= 0) {
          const ctl = this.getAnimatedTexControl(mat);
          if (ctl && ctl.stop) ctl.stop();
        }
      })
      .start();
  }
  private fadeInAndPlayAnimatedMaterial(mat: Material | null, toAlpha: number, durSec: number, loopCount: number = -1): void {
    if (!mat) return;
    const ctl = this.getAnimatedTexControl(mat);
    if (ctl && ctl.play) ctl.play(loopCount, 0);
    LSTween.alphaTo(mat, toAlpha, durSec).start();
  }
  private getAnimatedTexControl(mat: Material): AnimatedTextureFileProvider | null {
    try {
      const baseTex = mat.mainPass && mat.mainPass.baseTex;
      const ctl = baseTex ? (baseTex.control as AnimatedTextureFileProvider) : null;
      return ctl || null;
    } catch (_) { return null; }
  }

  // Material fading helpers
  private fadeSceneObject(obj: SceneObject, fromA: number, toA: number, dur: number, onDone?: () => void): void {
    if (!obj) { onDone && onDone(); return; }
    const mat = this.getObjectMaterial(obj);
    if (!mat) { onDone && onDone(); return; }
    const c = mat.mainPass.baseColor;
    mat.mainPass.baseColor = new vec4(c.r, c.g, c.b, fromA);
    LSTween.alphaTo(mat, toA, dur).onComplete(() => onDone && onDone()).start();
  }
  private getObjectMaterial(so: SceneObject): Material | null {
    const rm = so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    if (rm && rm.mainMaterial) return rm.mainMaterial;
    const img = so.getComponent("Component.Image") as Image;
    if (img && img.mainMaterial) return img.mainMaterial;
    return null;
  }
}

// Types
interface FragmentData {
  sceneObject: SceneObject;
  name: string;
  direction: vec3;
  collected: boolean;
  originalPosition: vec3;         // kept for reference
  originalLocalPosition: vec3;    // used for return
  interactable: Interactable | null;
}
