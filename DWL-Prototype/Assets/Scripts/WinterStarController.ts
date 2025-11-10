import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { SIK } from "SpectaclesInteractionKit.lspkg/SIK";
import { LSTween } from "LSTween.lspkg/LSTween";
import { Tween } from "LSTween.lspkg/TweenJS/Tween";
import Easing from "LSTween.lspkg/TweenJS/Easing";

@component
export class WinterStarController extends BaseScriptComponent {
    // Scene Objects
    @input winterStarContainer: SceneObject;
    @input winterStarHolder: SceneObject;
    @input fragment1: SceneObject;
    @input fragment2: SceneObject;
    @input fragment3: SceneObject;
    @input christmasTree: SceneObject;
    @input ornaments: SceneObject[] = [];
    @input haloComplete: SceneObject;
    @input haloCompleteMaterial: Material;
    @input starBorder: SceneObject;
    @input starBorderMaterial: Material;
    @input windAnimation: SceneObject;
    @input starParticlesLeft: SceneObject;
    @input starParticlesRight: SceneObject;
    @input landscapeElements: SceneObject[] = [];
    
    // UI
    @input instructionText: Text;
    
    // Audio
    @input soundtrackAudio: AudioComponent;
    @input windSound: AudioComponent;
    @input explosionSound: AudioComponent;
    @input collectedSound: AudioComponent;
    @input unificationSound: AudioComponent;
    
    // Star Descent Animation (CORE)
    @input descentDistance: number = 0.3; // ~1 foot in meters
    @input descentDuration: number = 5.0;
    @input descentStartScale: number = 0.0;
    @input descentEndScale: number = 0.05;
    
    // Explosion Animation
    @input explosionDistance: number = 0.5;
    @input explosionDuration: number = 1.0;
    
    // Collection Animation
    @input collectDuration: number = 0.8;
    
    // Wind Animation
    @input windFadeInDuration: number = 1.0;
    @input windVisibleDuration: number = 5.0;
    @input windFadeOutDuration: number = 1.0;
    
    // Halo Animation
    @input haloRotationDuration: number = 10.0;
    @input haloFadeDuration: number = 1.0;
    
    // Unification Animation (CORE)
    @input unificationRiseDistance: number = 0.6; // ~2 feet
    @input unificationRiseDuration: number = 3.0;
    @input treeAnimationDuration: number = 3.0;
    
    // Ornament Animation
    @input ornamentScaleInDuration: number = 0.5;
    @input ornamentScaleInDelayMin: number = 0.0;
    @input ornamentScaleInDelayMax: number = 3.0;
    
    // Landscape Elements
    @input landscapeScaleInDuration: number = 2.0;
    @input landscapeScaleInDelayMin: number = 0.0;
    @input landscapeScaleInDelayMax: number = 2.0;
    
    // UI Settings
    @input uiMessageDuration: number = 5.0;
    @input uiFadeInDuration: number = 0.5;
    @input uiFadeOutDuration: number = 0.5;
    
    // Failsafe
    @input failsafeTimeout: number = 120.0;
    
    // State machine
    private readonly States = {
        DESCENDING: 'descending',
        WIND_BLOWING: 'wind_blowing',
        EXPLODING: 'exploding',
        COLLECTING: 'collecting',
        UNIFYING: 'unifying',
        COMPLETE: 'complete'
    };
    
    private currentState: string = this.States.DESCENDING;
    private fragmentsCollected: number = 0;
    private fragmentData: FragmentData[] = [];
    private failsafeTimer: DelayedCallbackEvent | null = null;
    private activeTweens: Tween<any>[] = [];
    private uiHideTimer: DelayedCallbackEvent | null = null;
    private interactionManager = SIK.InteractionManager;
    private haloRotationTween: Tween<any> | null = null;
    private originalTextAlpha: number = 1.0;
    
    onAwake() {
        this.createEvent('OnStartEvent').bind(() => {
            this.init();
        });
        
        this.createEvent('UpdateEvent').bind(() => {
            this.onUpdate();
        });
    }
    
    /**
     * Initialize the experience
     */
    private init(): void {
        print('WinterStarController: Initializing experience');
        
        // Store original text alpha if available
        if (this.instructionText) {
            const textMaterial = this.instructionText.getSceneObject().getComponent('Component.RenderMeshVisual');
            if (textMaterial) {
                this.originalTextAlpha = textMaterial.mainPass.baseColor.a;
            }
        }
        
        // Setup fragments
        this.setupFragments();
        
        // Setup interaction callbacks
        this.setupInteractions();
        
        // Start background soundtrack
        if (this.soundtrackAudio) {
            this.soundtrackAudio.play(-1); // Loop indefinitely
            print('WinterStarController: Background soundtrack started');
        }
        
        // Start halo rotation
        //this.startHaloRotation();
        
        // Hide UI initially
        if (this.instructionText) {
            this.instructionText.enabled = false;
        }
        
        // Hide wind animation initially
        if (this.windAnimation) {
            this.windAnimation.enabled = false;
        }
        
        // Disable star particles initially
        if (this.starParticlesLeft) {
            this.starParticlesLeft.enabled = false;
        }
        if (this.starParticlesRight) {
            this.starParticlesRight.enabled = false;
        }
        
        // Hide ornaments initially
        if (this.ornaments && this.ornaments.length > 0) {
            this.ornaments.forEach(ornament => {
                if (ornament) {
                    ornament.enabled = false;
                }
            });
        }
        
        // Hide landscape elements initially
        if (this.landscapeElements && this.landscapeElements.length > 0) {
            this.landscapeElements.forEach(element => {
                if (element) {
                    element.enabled = false;
                }
            });
        }
        
        // Start the experience with star descent
        this.startStarDescent();
    }
    
    /**
     * Setup fragment data and initial positions
     */
    private setupFragments(): void {
        this.fragmentData = [
            {
                sceneObject: this.fragment1,
                name: 'fragment1',
                direction: new vec3(0, 0.5, -0.3),
                collected: false,
                originalPosition: vec3.zero(), // Will be set after descent
                interactable: null
            },
            {
                sceneObject: this.fragment2,
                name: 'fragment2',
                direction: new vec3(-0.6, -0.2, -0.2),
                collected: false,
                originalPosition: vec3.zero(), // Will be set after descent
                interactable: null
            },
            {
                sceneObject: this.fragment3,
                name: 'fragment3',
                direction: new vec3(0.6, -0.2, -0.2),
                collected: false,
                originalPosition: vec3.zero(), // Will be set after descent
                interactable: null
            }
        ];

        this.fragmentData.forEach((fragment) => {
            // Don't store position yet - will be done after descent animation
            
            // Find Interactable component by checking ScriptComponents
            const interactable = fragment.sceneObject.getComponent(Interactable.getTypeName()) as Interactable;
            
            if (!interactable) {
                print(`ERROR: No Interactable component found on ${fragment.name}`);
            } else {
                print(`WinterStarController: Found Interactable on ${fragment.name}`);
            }
            
            fragment.interactable = interactable;
        });

        print(`WinterStarController: ${this.fragmentData.length} fragments setup complete`);
    }
    
    /**
     * Store fragment original positions after descent completes
     */
    private storeFragmentPositions(): void {
        this.fragmentData.forEach((fragment) => {
            const fragmentTransform = fragment.sceneObject.getTransform();
            fragment.originalPosition = fragmentTransform.getWorldPosition();
            print(`WinterStarController: Stored position for ${fragment.name}: ${fragment.originalPosition.toString()}`);
        });
    }
    
    /**
     * Setup interaction callbacks for each fragment
     */
    private setupInteractions(): void {
        this.fragmentData.forEach((fragment, index) => {
            if (fragment.interactable) {
                fragment.interactable.onTriggerEnd.add(() => {
                    this.onFragmentSelected(index);
                });
                
                print(`WinterStarController: Interaction setup for ${fragment.name}`);
            }
        });
    }
    
    /**
     * Start star descent animation (CORE)
     */
    private startStarDescent(): void {
        print('WinterStarController: Starting star descent');
        
        this.currentState = this.States.DESCENDING;
        
        if (!this.winterStarHolder) {
            print('ERROR: winterStarHolder not assigned');
            return;
        }
        
        const holderTransform = this.winterStarHolder.getTransform();
        const startPos = holderTransform.getLocalPosition();
        const targetPos = new vec3(startPos.x, startPos.y - this.descentDistance, startPos.z);
        
        // Position tween
        const tweenData = { x: startPos.x, y: startPos.y, z: startPos.z };
        const descentTween = new Tween(tweenData)
            .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, this.descentDuration * 1000)
            .easing(Easing.Quadratic.InOut)
            .onUpdate(() => {
                holderTransform.setLocalPosition(new vec3(tweenData.x, tweenData.y, tweenData.z));
            })
            .onComplete(() => {
                // Store fragment positions AFTER descent completes
                this.storeFragmentPositions();
                
                // Then trigger wind
                this.triggerWind();
            })
            .start();
        
        // Scale tween (simultaneous)
        const scaleData = { scale: this.descentStartScale };
        const scaleTween = new Tween(scaleData)
            .to({ scale: this.descentEndScale }, this.descentDuration * 1000)
            .easing(Easing.Quadratic.InOut)
            .onUpdate(() => {
                holderTransform.setLocalScale(new vec3(scaleData.scale, scaleData.scale, scaleData.scale));
            })
            .start();
        
        this.activeTweens.push(descentTween);
        this.activeTweens.push(scaleTween);
    }
    
    /**
     * Trigger wind animation and sound
     */
    private triggerWind(): void {
        print('WinterStarController: Triggering wind');
        
        this.currentState = this.States.WIND_BLOWING;
        
        // Play wind sound
        if (this.windSound) {
            this.windSound.play(1);
        }
        
        // Fade in and play wind animation
        if (this.windAnimation) {
            this.windAnimation.enabled = true;
            
            // Get the Image component and play the 2D animation
            const imageComponent = this.windAnimation.getComponent('Component.Image') as Image;
            if (imageComponent) {
                const textureProvider = imageComponent.getMaterial(0).getPass(0).baseTex.control as AnimatedTextureFileProvider;
                if (textureProvider) {
                    textureProvider.play(1, 0); // Play once from start
                    print('WinterStarController: Wind 2D animation started');
                }
            }
            
            this.fadeSceneObject(this.windAnimation, 0, 1, this.windFadeInDuration, () => {
                // Wind stays visible, then fades out
                const delayedEvent = this.createEvent('DelayedCallbackEvent');
                delayedEvent.bind(() => {
                    this.fadeSceneObject(this.windAnimation, 1, 0, this.windFadeOutDuration, () => {
                        if (this.windAnimation) {
                            this.windAnimation.enabled = false;
                        }
                    });
                });
                delayedEvent.reset(this.windVisibleDuration);
            });
        }
        
        // Trigger explosion after wind starts
        const explosionDelay = this.createEvent('DelayedCallbackEvent');
        explosionDelay.bind(() => {
            this.explodeFragments();
            // Show first UI message
            this.updateInstructionText("The Winter Star\nhas been shattered!");
        });
        explosionDelay.reset(this.windFadeInDuration);
    }
    
    /**
     * Start halo rotation (loops indefinitely) - X-axis only
     */
    private startHaloRotation(): void {
        if (!this.haloComplete) {
            return;
        }
        
        const haloTransform = this.haloComplete.getTransform();
        const startAngle = 0;
        
        const tweenData = { angle: startAngle };
        this.haloRotationTween = new Tween(tweenData)
            .to({ angle: 360 }, this.haloRotationDuration * 1000)
            .easing(Easing.Linear.None)
            .onUpdate(() => {
                // Rotate only on X-axis
                const rotation = quat.angleAxis(tweenData.angle * Math.PI / 180, vec3.right());
                haloTransform.setLocalRotation(rotation);
            })
            .repeat(Infinity)
            .start();
        
        this.activeTweens.push(this.haloRotationTween);
        
        print('WinterStarController: Halo rotation started (X-axis only)');
    }
    
    /**
     * Explode fragments outward and down
     */
    private explodeFragments(): void {
        print('WinterStarController: Exploding fragments');
        
        this.currentState = this.States.EXPLODING;
        
        // Play explosion sound
        if (this.explosionSound) {
            this.explosionSound.play(1);
        }
        
        // Fade out halo
        if (this.haloComplete) {
            LSTween.alphaTo(this.haloCompleteMaterial, 0, this.haloFadeDuration).start()
        }
        
        // Fade starBorder to 20% alpha using material input
        if (this.starBorderMaterial) {
            LSTween.alphaTo(this.starBorderMaterial, 0.20, this.haloFadeDuration).start();
        }
        
        this.fragmentData.forEach((fragment) => {
            const transform = fragment.sceneObject.getTransform();
            const startPos = transform.getWorldPosition();
            
            const targetPos = startPos.add(
                fragment.direction.uniformScale(this.explosionDistance)
            );
            
            print(`WinterStarController: ${fragment.name} exploding from ${startPos.toString()} to ${targetPos.toString()}`);
            
            const tweenData = { x: startPos.x, y: startPos.y, z: startPos.z };
            const tween = new Tween(tweenData)
                .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, this.explosionDuration * 1000)
                .easing(Easing.Quadratic.Out)
                .onUpdate(() => {
                    transform.setWorldPosition(new vec3(tweenData.x, tweenData.y, tweenData.z));
                })
                .start();
            
            this.activeTweens.push(tween);
        });
        
        const delayedEvent = this.createEvent('DelayedCallbackEvent');
        delayedEvent.bind(() => {
            this.startCollecting();
        });
        delayedEvent.reset(this.explosionDuration);
    }
    
    /**
     * Transition to collecting state and start failsafe timer
     */
    private startCollecting(): void {
        print('WinterStarController: Starting collection phase');
        
        this.currentState = this.States.COLLECTING;
        
        // Show collection instructions
        this.updateInstructionText("Bring it back to life by\ncollecting the fragments", () => {
            // After first message, show pinch instruction
            this.updateInstructionText("Pinch to select\nthe star fragments.");
        });
        
        this.startFailsafeTimer();
    }
    
    /**
     * Handle fragment selection via pinch
     */
    private onFragmentSelected(fragmentIndex: number): void {
        if (this.currentState !== this.States.COLLECTING) {
            return;
        }
        
        const fragment = this.fragmentData[fragmentIndex];
        
        if (fragment.collected) {
            print(`WinterStarController: Fragment ${fragment.name} already collected`);
            return;
        }
        
        print(`WinterStarController: Fragment ${fragment.name} selected`);
        
        // Play collected sound
        if (this.collectedSound) {
            this.collectedSound.play(1);
        }
        
        fragment.collected = true;
        this.fragmentsCollected++;
        
        if (fragment.interactable) {
            fragment.interactable.enabled = false;
        }
        
        this.animateFragmentReturn(fragment);
        
        if (this.fragmentsCollected >= this.fragmentData.length) {
            if (this.failsafeTimer) {
                this.removeEvent(this.failsafeTimer);
                this.failsafeTimer = null;
            }
            
            const delayedEvent = this.createEvent('DelayedCallbackEvent');
            delayedEvent.bind(() => {
                this.startUnification();
            });
            delayedEvent.reset(0.5);
        } else {
            const remaining = this.fragmentData.length - this.fragmentsCollected;
            this.updateInstructionText(`${remaining} fragment${remaining > 1 ? 's' : ''} remaining...`);
        }
    }
    
    /**
     * Animate fragment returning to container
     */
    private animateFragmentReturn(fragment: FragmentData): void {
        const transform = fragment.sceneObject.getTransform();
        const currentPos = transform.getWorldPosition();
        const targetPos = fragment.originalPosition;
        
        print(`WinterStarController: ${fragment.name} returning from ${currentPos.toString()} to ${targetPos.toString()}`);
        
        const tweenData = { x: currentPos.x, y: currentPos.y, z: currentPos.z };
        const tween = new Tween(tweenData)
            .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, this.collectDuration * 1000)
            .easing(Easing.Cubic.InOut)
            .onUpdate(() => {
                transform.setWorldPosition(new vec3(tweenData.x, tweenData.y, tweenData.z));
            })
            .start();
        
        this.activeTweens.push(tween);
    }
    
    /**
     * Start failsafe timer
     */
    private startFailsafeTimer(): void {
        print(`WinterStarController: Starting ${this.failsafeTimeout}-second failsafe timer`);
        
        this.failsafeTimer = this.createEvent('DelayedCallbackEvent');
        this.failsafeTimer.bind(() => {
            this.onFailsafeTriggered();
        });
        this.failsafeTimer.reset(this.failsafeTimeout);
    }
    
    /**
     * Handle failsafe timer expiration
     */
    private onFailsafeTriggered(): void {
        if (this.currentState !== this.States.COLLECTING) {
            return;
        }
        
        print('WinterStarController: Failsafe triggered - auto-collecting fragments');
        
        this.fragmentData.forEach((fragment) => {
            if (!fragment.collected) {
                fragment.collected = true;
                this.fragmentsCollected++;
                
                if (fragment.interactable) {
                    fragment.interactable.enabled = false;
                }
                
                this.animateFragmentReturn(fragment);
            }
        });
        
        const delayedEvent = this.createEvent('DelayedCallbackEvent');
        delayedEvent.bind(() => {
            this.startUnification();
        });
        delayedEvent.reset(this.collectDuration + 0.5);
    }
    
    /**
     * Start the unification sequence (CORE)
     */
    private startUnification(): void {
        print('WinterStarController: Starting unification sequence');
        
        this.currentState = this.States.UNIFYING;
        
        // Play unification sound
        if (this.unificationSound) {
            this.unificationSound.play(1);
        }
        
        // Fade in halo
        if (this.haloComplete) {
            LSTween.alphaTo(this.haloCompleteMaterial, 1, this.haloFadeDuration).start()
        }
        
        // Fade starBorder back to 100% alpha using material input
        if (this.starBorderMaterial) {
            LSTween.alphaTo(this.starBorderMaterial, 1, this.haloFadeDuration).start();
        }
        
        // Show unification UI
        this.updateInstructionText("The Winter Star\nburns bright again!");
        
        // Rise the Winter Star Holder (CORE animation)
        if (this.winterStarHolder) {
            const holderTransform = this.winterStarHolder.getTransform();
            const startPos = holderTransform.getLocalPosition();
            const targetPos = new vec3(startPos.x, startPos.y + this.unificationRiseDistance, startPos.z);
            
            const tweenData = { x: startPos.x, y: startPos.y, z: startPos.z };
            const riseTween = new Tween(tweenData)
                .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, this.unificationRiseDuration * 1000)
                .easing(Easing.Quadratic.InOut)
                .onUpdate(() => {
                    holderTransform.setLocalPosition(new vec3(tweenData.x, tweenData.y, tweenData.z));
                })
                .start();
            
            this.activeTweens.push(riseTween);
        }
        
        // Animate Christmas tree with Animation Player
        this.animateChristmasTree();
        
        // Animate ornaments appearing on tree in random order
        this.animateOrnaments();
        
        // Scale in landscape elements randomly
        this.animateLandscapeElements();
        
        // Wait for animations to complete, then show final message
        const finalMessageDelay = this.createEvent('DelayedCallbackEvent');
        finalMessageDelay.bind(() => {
            this.completeExperience();
        });
        finalMessageDelay.reset(this.unificationRiseDuration + 1.0);
    }
    
    /**
     * Animate Christmas tree using Animation Player
     */
    private animateChristmasTree(): void {
        if (!this.christmasTree) {
            return;
        }
        
        // Enable the tree
        this.christmasTree.enabled = true;
        
        // Get Animation Player component
        const animationPlayer = this.christmasTree.getComponent('Component.AnimationPlayer') as AnimationPlayer;
        
        if (animationPlayer) {
            // Play all clips
            animationPlayer.playAll();
            print('WinterStarController: Christmas tree animation started');
        } else {
            print('WARNING: No AnimationPlayer component found on Christmas tree');
        }
    }
    
    /**
     * Animate ornaments scaling in randomly
     */
    private animateOrnaments(): void {
        if (!this.ornaments || this.ornaments.length === 0) {
            return;
        }
        
        this.ornaments.forEach((ornament, index) => {
            if (!ornament) return;
            
            // Random delay for each ornament
            const randomDelay = this.ornamentScaleInDelayMin + 
                Math.random() * (this.ornamentScaleInDelayMax - this.ornamentScaleInDelayMin);
            
            const delayedEvent = this.createEvent('DelayedCallbackEvent');
            delayedEvent.bind(() => {
                ornament.enabled = true;
                
                const transform = ornament.getTransform();
                const startScale = new vec3(0.01, 0.01, 0.01);
                const targetScale = new vec3(1, 1, 1);
                
                transform.setLocalScale(startScale);
                
                const tweenData = { x: 0.01, y: 0.01, z: 0.01 };
                const scaleTween = new Tween(tweenData)
                    .to({ x: 1, y: 1, z: 1 }, this.ornamentScaleInDuration * 1000)
                    .easing(Easing.Back.Out)
                    .onUpdate(() => {
                        transform.setLocalScale(new vec3(tweenData.x, tweenData.y, tweenData.z));
                    })
                    .start();
                
                this.activeTweens.push(scaleTween);
            });
            delayedEvent.reset(randomDelay);
        });
        
        print(`WinterStarController: Animating ${this.ornaments.length} ornaments`);
    }
    
    /**
     * Animate landscape elements scaling in randomly
     */
    private animateLandscapeElements(): void {
        if (!this.landscapeElements || this.landscapeElements.length === 0) {
            return;
        }
        
        this.landscapeElements.forEach((element, index) => {
            if (!element) return;
            
            // Random delay for each element
            const randomDelay = this.landscapeScaleInDelayMin + 
                Math.random() * (this.landscapeScaleInDelayMax - this.landscapeScaleInDelayMin);
            
            const delayedEvent = this.createEvent('DelayedCallbackEvent');
            delayedEvent.bind(() => {
                element.enabled = true;
                
                const transform = element.getTransform();
                const startScale = new vec3(0.01, 0.01, 0.01);
                const targetScale = new vec3(1, 1, 1);
                
                transform.setLocalScale(startScale);
                
                const tweenData = { x: 0.01, y: 0.01, z: 0.01 };
                const scaleTween = new Tween(tweenData)
                    .to({ x: 1, y: 1, z: 1 }, this.landscapeScaleInDuration * 1000)
                    .easing(Easing.Quadratic.InOut)
                    .onUpdate(() => {
                        transform.setLocalScale(new vec3(tweenData.x, tweenData.y, tweenData.z));
                    })
                    .start();
                
                this.activeTweens.push(scaleTween);
            });
            delayedEvent.reset(randomDelay);
        });
        
        print(`WinterStarController: Animating ${this.landscapeElements.length} landscape elements`);
    }
    
    /**
     * Complete the experience
     */
    private completeExperience(): void {
        print('WinterStarController: Experience complete');
        
        this.currentState = this.States.COMPLETE;
        
        // Enable star particles on wrists
        if (this.starParticlesLeft) {
            this.starParticlesLeft.enabled = true;
            print('WinterStarController: Star particles left enabled');
        }
        if (this.starParticlesRight) {
            this.starParticlesRight.enabled = true;
            print('WinterStarController: Star particles right enabled');
        }
        
        // Show final UI message
        this.updateInstructionText("Move your hand.\nYou are a star\nbearer now.");
    }
    
    /**
     * Update instruction text with fade in/out animations
     */
    private updateInstructionText(message: string, onComplete?: () => void): void {
        if (!this.instructionText) {
            print(`WinterStarController: ${message}`);
            if (onComplete) onComplete();
            return;
        }
        
        print(`WinterStarController: ${message}`);
        
        // Cancel existing hide timer
        if (this.uiHideTimer) {
            this.removeEvent(this.uiHideTimer);
            this.uiHideTimer = null;
        }
        
        // Set the text
        this.instructionText.text = message;
        this.instructionText.enabled = true;
        
        // Get the text material for alpha manipulation
        const textObject = this.instructionText.getSceneObject();
        const renderMesh = textObject.getComponent('Component.RenderMeshVisual') as RenderMeshVisual;
        
        if (renderMesh) {
            // Fade in
            const fadeInData = { alpha: 0 };
            const fadeInTween = new Tween(fadeInData)
                .to({ alpha: this.originalTextAlpha }, this.uiFadeInDuration * 1000)
                .easing(Easing.Quadratic.InOut)
                .onUpdate(() => {
                    const color = renderMesh.mainPass.baseColor;
                    renderMesh.mainPass.baseColor = new vec4(color.r, color.g, color.b, fadeInData.alpha);
                })
                .onComplete(() => {
                    // Wait for message duration, then fade out
                    this.uiHideTimer = this.createEvent('DelayedCallbackEvent');
                    this.uiHideTimer.bind(() => {
                        const fadeOutData = { alpha: this.originalTextAlpha };
                        const fadeOutTween = new Tween(fadeOutData)
                            .to({ alpha: 0 }, this.uiFadeOutDuration * 1000)
                            .easing(Easing.Quadratic.InOut)
                            .onUpdate(() => {
                                const color = renderMesh.mainPass.baseColor;
                                renderMesh.mainPass.baseColor = new vec4(color.r, color.g, color.b, fadeOutData.alpha);
                            })
                            .onComplete(() => {
                                this.instructionText.enabled = false;
                                this.uiHideTimer = null;
                                if (onComplete) onComplete();
                            })
                            .start();
                        
                        this.activeTweens.push(fadeOutTween);
                    });
                    this.uiHideTimer.reset(this.uiMessageDuration);
                })
                .start();
            
            this.activeTweens.push(fadeInTween);
        } else {
            // Fallback if we can't get the material
            this.uiHideTimer = this.createEvent('DelayedCallbackEvent');
            this.uiHideTimer.bind(() => {
                this.instructionText.enabled = false;
                this.uiHideTimer = null;
                if (onComplete) onComplete();
            });
            this.uiHideTimer.reset(this.uiMessageDuration);
        }
    }
    
    /**
     * Fade a material's alpha using LSTween.alphaTo
     */
    private fadeMaterial(material: Material, fromAlpha: number, toAlpha: number, duration: number, onComplete?: () => void): void {
        if (!material) {
            print('WARNING: fadeMaterial - material is null');
            if (onComplete) onComplete();
            return;
        }
        
        print(`Fading material from ${fromAlpha} to ${toAlpha} over ${duration}s using LSTween.alphaTo`);
        
        // Set initial alpha
        const color = material.mainPass.baseColor;
        material.mainPass.baseColor = new vec4(color.r, color.g, color.b, fromAlpha);
        
        // Use LSTween.alphaTo
        LSTween.alphaTo(material, toAlpha, duration);
        
        if (onComplete) {
            // Add completion callback using delayed event
            const checkComplete = this.createEvent('DelayedCallbackEvent');
            checkComplete.bind(() => {
                print(`Fade complete - final alpha: ${toAlpha}`);
                onComplete();
            });
            checkComplete.reset(duration);
        }
    }
    
    /**
     * Fade a scene object in or out using LSTween.alphaTo
     */
    private fadeSceneObject(sceneObject: SceneObject, fromAlpha: number, toAlpha: number, duration: number, onComplete?: () => void): void {
        if (!sceneObject) {
            print('WARNING: fadeSceneObject - sceneObject is null');
            if (onComplete) onComplete();
            return;
        }
        
        print(`Fading ${sceneObject.name} from ${fromAlpha} to ${toAlpha} over ${duration}s using LSTween.alphaTo`);
        
        // Set initial alpha
        const renderMesh = sceneObject.getComponent('Component.RenderMeshVisual') as RenderMeshVisual;
        const imageComponent = sceneObject.getComponent('Component.Image') as Image;
        
        let material: Material | null = null;
        
        if (renderMesh && renderMesh.mainMaterial) {
            material = renderMesh.mainMaterial;
            const color = renderMesh.mainPass.baseColor;
            renderMesh.mainPass.baseColor = new vec4(color.r, color.g, color.b, fromAlpha);
        }
        
        if (imageComponent && imageComponent.mainMaterial) {
            material = imageComponent.mainMaterial;
            const color = imageComponent.mainPass.baseColor;
            imageComponent.mainPass.baseColor = new vec4(color.r, color.g, color.b, fromAlpha);
        }
        
        if (!material) {
            print(`WARNING: No material found on ${sceneObject.name} for fading`);
            if (onComplete) onComplete();
            return;
        }
        
        // Use LSTween.alphaTo - signature is: alphaTo(material, alpha, time)
        LSTween.alphaTo(material, toAlpha, duration);
        
        if (onComplete) {
            // Add completion callback using delayed event
            const checkComplete = this.createEvent('DelayedCallbackEvent');
            checkComplete.bind(() => {
                print(`Fade complete for ${sceneObject.name} - final alpha: ${toAlpha}`);
                onComplete();
            });
            checkComplete.reset(duration);
        }
    }
    
    /**
     * Update loop for tweens
     */
    private onUpdate(): void {
        const currentTime = getTime() * 1000;
        
        this.activeTweens.forEach((tween) => {
            if (tween && tween.update) {
                tween.update(currentTime);
            }
        });
    }
}

// Type definition for fragment data
interface FragmentData {
    sceneObject: SceneObject;
    name: string;
    direction: vec3;
    collected: boolean;
    originalPosition: vec3;
    interactable: Interactable | null;
}