import { LSTween } from "LSTween.lspkg/LSTween";
import Easing from "LSTween.lspkg/TweenJS/Easing";

@component
export class ChristmasTreeAnim extends BaseScriptComponent {
  @input parent: SceneObject;            // Parent whose children will animate
  @input delayBetween: number = 0.5;     // Seconds between enabling each child
  @input startDelay: number = 0.0;       // Optional delay before starting
  @input rotationDuration: number = 3.0; // Duration of each rotation
  @input rotationDegrees: number = 45.0; // Rotation amount around X axis

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.enableAndRotateChildren());
  }

  private enableAndRotateChildren(): void {
    if (!this.parent) {
      print("ChristmasTreeAnim: parent not assigned.");
      return;
    }

    const children = this.getDirectChildren(this.parent);
    if (children.length === 0) return;

    // Disable all children first for a clean start
    children.forEach(ch => { if (ch) ch.enabled = false; });

    // Enable and rotate each one in sequence
    children.forEach((child, index) => {
      if (!child) return;

      const evt = this.createEvent("DelayedCallbackEvent");
      evt.bind(() => {
        child.enabled = true;

        const tr = child.getTransform();
        const startRot = tr.getLocalRotation();
        // ✅ Correct usage — multiply by MathUtils.DegToRad, not call it
        const rotQuat = quat.angleAxis(this.rotationDegrees * MathUtils.DegToRad, vec3.up());
        const endRot = rotQuat.multiply(startRot);

        LSTween.rotateToLocal(tr, endRot, this.rotationDuration * 1000)
          .easing(Easing.Quadratic.InOut)
          .start();
      });

      evt.reset(this.startDelay + index * this.delayBetween);
    });
  }

  private getDirectChildren(parent: SceneObject): SceneObject[] {
    const out: SceneObject[] = [];
    const count = parent.getChildrenCount();
    for (let i = 0; i < count; i++) {
      const child = parent.getChild(i);
      if (child) out.push(child);
    }
    return out;
  }
}
