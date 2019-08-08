import {
    Vector2,
    Vector3,
    Plane,
    Raycaster,
    EventDispatcher
} from "../libs/three.module.js";

const STATE = {
    NONE: -1,
    ROTATE: 0,
    ZOOM: 1,
    PAN: 2,
    CLICK: 3,
    RIGHT_CLICK: 4,
    TOUCH_ROTATE: 5,
    TOUCH_ZOOM_PAN: 6,
}
const userRotateSpeed = 2.0
const PIXELS_PER_ROUND = 1800
const SCALE_STEP = 1.07
const TOUCH_SCALE_STEP = 1.03

function addEvent(el, type, fn, capture) {
    el.addEventListener(type, fn, capture)
}

function removeEvent(el, type, fn, capture) {
    el.removeEventListener(type, fn, capture)
}

function bound(min, value, max) {
    return Math.max(min, Math.min(value, max))
}

class GestureControls {
    constructor(camera, domElement) {
        this.camera = camera
        this.domElement = domElement

        this.enableDamping = false;
        this.enabled = true;
        this.scrollWheelZoomEnabled = true
        this.basicPlane = new Plane(new Vector3(0, 1, 0), 0);
        this.distance = this.camera.position.distanceTo(new Vector3()) || 500;

        this.maxTiltAngle = 75;
        this.minTiltAngle = 0;

        this.maxScale = 5;
        this.minScale = 0.2;

        this.needsUpdate = true

        this.onClickListener = null

        this.onHoverListener = null

        this._initListeners()
        this._initVars()
    }

    destroy() {
        this._initListeners(true)
    }

    reset() {
        this._initVars()
    }

    pan(start, end) {
        let vector = this.viewToWorld(start).sub(this.viewToWorld(end))

        this.offset.add(vector);

        this.dampingUpdate();
    }

    setRotateAngle(angle) {
        this.rotateAngle = angle;
        this.dampingUpdate();
    }

    setTiltAngle(angle) {
        this.tiltAngle = bound(this.minTiltAngle, angle, this.maxTiltAngle)
        this.dampingUpdate();
    }

    setScale(scale) {
        this.scale = bound(this.minScale, scale, this.maxScale);
        this.dampingUpdate();
    }

    dampingUpdate() {
        if (this.enableDamping) {
            this.needsUpdate = true;
        } else {
            this.update();
        }
    }

    _initVars() {
        this.startPosition = new Vector2()
        this.startPosition2 = new Vector2()
        this.endPosition = new Vector2()
        this.deltaVector = new Vector2()
        this.touchStartPoints = [new Vector2(), new Vector2(), new Vector2()]
        this.touchEndPoints = [new Vector2(), new Vector2(), new Vector2()]

        this.tiltAngle = 0
        this.rotateAngle = 0
        this.scale = 1

        this.state = STATE.NONE

        this.lastPosition = new Vector3()

        this.offset = new Vector3()
    }

    _initListeners(remove) {
        let eventType = remove ? removeEvent : addEvent
        eventType(this.domElement, 'touchstart', this, {
            passive: false,
        })
        eventType(this.domElement, 'mousedown', this, {
            passive: false,
        })
        eventType(window, 'touchend', this, {
            passive: false,
        })
        eventType(window, 'mouseup', this, {
            passive: false,
        })
        eventType(window, 'touchmove', this, {
            passive: false,
        })
        eventType(window, 'mousemove', this)
        eventType(this.domElement.parentElement, 'mousewheel', this)
        eventType(this.domElement, 'contextmenu', this, false)
    }

    handleEvent(e) {
        switch (e.type) {
            case 'touchstart':
            case 'mousedown':
                if (e.touches && e.touches.length > 1) {
                    this._touchStart(e)
                } else {
                    this._start(e)
                }
                break
            case 'touchmove':
            case 'mousemove':
                if (e.touches && e.touches.length > 1 && (this.state === STATE.ZOOM || this.state === STATE.ROTATE)) {
                    this._touchMove(e)
                } else {
                    this._move(e)
                }
                break
            case 'mouseout':
                this.state = STATE.NONE
                break
            case 'touchend':
            case 'mouseup':
                this._end(e)
                break
            case 'mousewheel':
                this._wheel(e)
                break
            case 'contextmenu':
                e.preventDefault()
                break
        }
    }

    _start(e) {
        if (!this.enabled) return

        if (this.state === STATE.NONE) {
            if (e.button === 0 || (e.touches && e.touches.length == 1)) {
                this.state = STATE.CLICK
            } else if (e.button === 1) {
                this.state = STATE.ZOOM
            } else if (e.button === 2) {
                this.state = STATE.RIGHT_CLICK
            }
        }

        const point = e.touches ? e.touches[0] : e

        this.startPosition.set(point.offsetX, point.offsetY)
        this.endPosition.copy(this.startPosition)
        this.startPosition2.set(point.clientX, point.clientY)
    }

    _move(e) {
        if (!this.enabled) return
        if (this.state !== STATE.NONE) {
            const point = e.touches ? e.touches[0] : e

            this.endPosition
                .set(this.endPosition.x + point.clientX, this.endPosition.y + point.clientY)
                .sub(this.startPosition2)
            this.startPosition2.set(point.clientX, point.clientY)
            this.deltaVector.subVectors(this.endPosition, this.startPosition)
            const delta = this.deltaVector.length()
            if (delta > 0) {
                if ((this.state === STATE.RIGHT_CLICK && delta > 2) || this.state === STATE.ROTATE) {
                    this.state = STATE.ROTATE
                    this.setRotateAngle(this.rotateAngle - ((360 * this.deltaVector.x) / PIXELS_PER_ROUND) * userRotateSpeed)
                    this.setTiltAngle(this.tiltAngle - ((360 * this.deltaVector.y) / PIXELS_PER_ROUND) * userRotateSpeed)
                } else if (this.state === STATE.ZOOM) {
                    if (this.deltaVector.y > 0) {
                        this.scale *= (1 / TOUCH_SCALE_STEP)
                    } else {
                        this.scale *= (TOUCH_SCALE_STEP)
                    }
                    this.setScale(this.scale);
                } else if ((this.state === STATE.CLICK && delta > 2) || this.state === STATE.PAN) {
                    this.state = STATE.PAN
                    this.dampingUpdate();
                }
                if (this.state !== STATE.CLICK && this.state !== STATE.PAN && this.state !== STATE.RIGHT_CLICK) {
                    this.startPosition.copy(this.endPosition)
                }
            }
        }
        if (this.domElement.contains(e.target)) {
            this.dispatchEvent({
                type: 'hover', message: {
                    domEvent: e
                }
            });
        }
    }

    _end(e) {
        if (!this.enabled) return
        if (this.state === STATE.NONE) return
        let state = this.state
        this.state = STATE.NONE
        if (state === STATE.CLICK) {
            const point = e.touches ? e.touches[0] : e
            console.log(this.viewToWorld({ x: point.clientX, y: point.clientY }))
            this.dispatchEvent({
                type: 'click',
                message: {
                    domEvent: e
                }
            });
        } else if (state === STATE.RIGHT_CLICK) {
            this.dispatchEvent({
                type: 'rightClick', message: {
                    domEvent: e
                }
            });
        }
    }

    _wheel(e) {
        if (!this.enabled) return
        if (!this.scrollWheelZoomEnabled) return
        if (this.state === STATE.ZOOM) return

        let delta = e.wheelDelta ? e.wheelDelta / 120 : -e.detail / 3
        let scale = Math.pow(SCALE_STEP, delta)
        this.setScale(this.scale * scale);
    }

    _touchStart(e) {
        if (!this.enabled) return
            ;[...e.touches]
                .filter((_, i) => i < 3)
                .map(({ pageX, pageY }, index) => this.touchStartPoints[index].set(pageX, pageY))
        if (e.touches.length === 2) {
            this.state = STATE.ZOOM
            this.span.innerHTML = '_touchStart'
        } else {
            this.state = STATE.ROTATE
        }
    }

    _touchMove(e) {
        if (!this.enabled) return
        if (this.state === STATE.NONE) return
            ;[...e.touches]
                .filter((_, i) => i < 3)
                .map(({ pageX, pageY }, index) => this.touchEndPoints[index].set(pageX, pageY))
        this.span.innerHTML = '_touchMove'
        if (this.state === STATE.ZOOM) {
            let dStart = this.touchStartPoints[1].distanceTo(this.touchStartPoints[0])
            let dEnd = this.touchEndPoints[1].distanceTo(this.touchEndPoints[0])
            if (Math.abs(dStart - dEnd) < 5) {
                return
            } else if (dStart < dEnd) {
                this.scale *= (TOUCH_SCALE_STEP)
            } else {
                this.scale *= (1 / TOUCH_SCALE_STEP)
            }
            this.setScale(this.scale);
        }
        this.touchEndPoints.forEach((p, i) => this.touchStartPoints[i].copy(p))
    }
}

Object.assign(GestureControls.prototype, EventDispatcher.prototype)
Object.assign(GestureControls.prototype, {
    viewToWorld: (function () {
        const raycaster = new Raycaster()
        const vector = new Vector3(0, 0, 0)

        return function (point) {
            vector.x = (point.x / this.domElement.clientWidth) * 2 - 1
            vector.y = -(point.y / this.domElement.clientHeight) * 2 + 1
            raycaster.setFromCamera(vector, this.camera)

            let result = new Vector3()
            raycaster.ray.intersectPlane(this.basicPlane, result)

            return result;
        }
    })(),
    update: (function () {
        let offsetVector = new Vector3()
        let LookAt = new Vector3(0, 0, 0)
        return function () {
            if (this.enableDamping && !this.needsUpdate) {
                return;
            }
            this.needsUpdate = false;

            let camera = this.camera;

            let rotate = this.rotateAngle
            let tilt = 0
            let scale = bound(this.minScale, this.scale, this.maxScale);
            let radius = (this.distance - this.basicPlane.constant) / scale;

            if (this.startPosition.distanceTo(this.endPosition) > 1e-3) {
                let vector = this.viewToWorld(this.startPosition).sub(this.viewToWorld(this.endPosition))
                this.startPosition.copy(this.endPosition)
                this.offset.add(vector)
            }

            tilt = bound(this.minTiltAngle, this.tiltAngle, this.maxTiltAngle)
            tilt = bound(0, tilt, 90);

            rotate = (rotate / 180) * Math.PI
            tilt = (tilt / 180) * Math.PI

            camera.position.copy(this.basicPlane.normal).multiplyScalar(this.distance / this.scale);
            camera.lookAt(LookAt.copy(this.basicPlane.normal).multiplyScalar(this.basicPlane.constant));
            camera.rotateOnAxis({ x: 0, y: 0, z: 1 }, rotate)
            camera.rotateOnAxis({ x: 1, y: 0, z: 0 }, tilt)

            offsetVector.x = radius * Math.sin(tilt) * Math.sin(rotate)
            offsetVector.y = radius * Math.cos(tilt) - radius
            offsetVector.z = radius * Math.sin(tilt) * Math.cos(rotate)

            camera.position.add(offsetVector).add(this.offset);
        }
    })(),
})

export { GestureControls }
