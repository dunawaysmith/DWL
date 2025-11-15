import { LSTween } from "LSTween.lspkg/LSTween";
import Easing from "LSTween.lspkg/TweenJS/Easing";

@component
export class StartStarBounce extends BaseScriptComponent {
  @input bounceDistance: number = 0.02;  // Distance to move up
  @input bounceDuration: number = 1.0;   // Duration in seconds (one way)
  @input autoStart: boolean = true;      // Start automatically on awake
  
  private originalPosition: vec3 | null = null;
  private isAnimating: boolean = false;

  onAwake() {
    if (this.autoStart) {
      this.createEvent("OnStartEvent").bind(() => this.startBounce());
    }
  }

  startBounce(): void {
    if (this.isAnimating) return;
    
    const tr = this.getSceneObject().getTransform();
    this.originalPosition = tr.getLocalPosition();
    this.isAnimating = true;
    
    this.bounceUp();
  }

  stopBounce(): void {
    this.isAnimating = false;
  }

  private bounceUp(): void {
    if (!this.isAnimating || !this.originalPosition) return;
    
    const tr = this.getSceneObject().getTransform();
    const upPos = new vec3(
      this.originalPosition.x,
      this.originalPosition.y + this.bounceDistance,
      this.originalPosition.z
    );
    
    LSTween.moveToLocal(tr, upPos, this.bounceDuration * 1000)
      .easing(Easing.Sinusoidal.InOut)  // Changed to Sinusoidal for softer ease
      .onComplete(() => this.bounceDown())
      .start();
  }

  private bounceDown(): void {
    if (!this.isAnimating || !this.originalPosition) return;
    
    const tr = this.getSceneObject().getTransform();
    
    LSTween.moveToLocal(tr, this.originalPosition, this.bounceDuration * 1000)
      .easing(Easing.Sinusoidal.InOut)  // Changed to Sinusoidal for softer ease
      .onComplete(() => this.bounceUp())  // Loop back to bounceUp
      .start();
  }
}