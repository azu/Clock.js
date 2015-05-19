/*
 | API                         | iOS      | Chrome | IE  | Android |
 |-----------------------------|----------|--------|-----|---------|
 | webkitRequestAnimationFrame | 6.0+     | YES    | 10+ | 4.4+    |
 | requestAnimationFrame       | 7.0+     | YES    | 10+ | 4.4+    |
 | performance.now()           | 8.0 only | YES    | 10+ | 4.4+    |
 */

/*
 var clock = new Clock([tick], { vsync: true, start: true });

 function tick(timeStamp, deltaTime) {
 update();
 }

 detail on https://github.com/uupaa/Clock.js/wiki/Clock
 */
interface ClockOptions {
    vsync?:boolean; // use RAF
    wait? :number;
    pulse? :number;
    start? : boolean;
    offset? : number;
}
interface ClockTick {
    (timeStamp: Number, deltaTime: Number): void
}

// define requestAnimationFrame
declare
var global: any;
var RAF = global["requestAnimationFrame"] ||
    global["webkitRequestAnimationFrame"] ||
    function (fn: ((timestamp: number) => void)) {
        setTimeout(fn, 1000 / 60, 0);
    };
var RAF_X = global["cancelAnimationFrame"] ||
    global["webkitCancelAnimationFrame"] ||
    function (id: number) {
        clearTimeout(id);
    };

// --- class / interfaces ----------------------------------
class ClockCL {
    private _ticks: ClockTick[]; // TickFunctionArray. [tick, ...]
    private _vsync: boolean; // vsync mode
    private _wait: number; // setInterval(tick, wait)
    private _pulse: number; // overwrite delta time(range of oscillation time)
    private _active: boolean; // active state.
    private _counter: number;
    private _timerID: number;   // timer id.
    private _baseTime: number;   //  offset from zero.
    private _timeOffset: number;    //  timeStamp offset.
    private _lastTimeStamp: number;
    private _bindingEnterFrame: Function;

    constructor(ticks: ClockTick[],
                options: ClockOptions) {
        // @options.vsync  Boolean = false - vsync mode.
        // @options.wait   Number = 16.666 - setInterval(tick, wait)
        // @options.pulse  Number = 0.0 - overwrite delta time(unit: ms)(range of oscillation time).
        // @options.start  Boolean = false - auto start.
        // @options.offset Number = 0.0 - timeStamp offset.
        // @desc Master Clock.

        options = options || {};

        this._ticks = [];                            // ClockTick Array. [tick, ...]
        this._vsync = options["vsync"] || false;     // vsync mode
        this._wait = options["wait"] || 1000 / 60; //  setInterval(tick, wait)
        this._pulse = options["pulse"] || 0.0;       // overwrite delta time(range of oscillation time).
        this._active = false;                         // active state.
        this._counter = 0;
        this._timerID = 0;                              // timer id.
        this._baseTime = 0;                             // offset from zero.
        this._timeOffset = options["offset"] || 0.0;    // timeStamp offset.
        this._lastTimeStamp = 0;                        // last time stamp.
        // bind this
        this._bindingEnterFrame = this._enterFrame.bind(this);
        // --- get base time ---
        if (this._vsync) {
            RAF(((timeStamp: number)=> {
                this._baseTime = timeStamp || Date.now();
            }));
        } else {
            this._baseTime = Date.now();
        }
        (ticks || []).forEach(this.on, this);
        if (options["start"]) {
            this.start();
        }
    }

    start(): void {
        if (this._active) {
            return;
        }
        this._active = true;
        this._timerID = this._vsync ? RAF(this._bindingEnterFrame)
            : setInterval(this._bindingEnterFrame, this._wait, 0);
    }

    stop(): void {
        if (!this._active) {
            return;
        }
        this._active = false;
        if (this._vsync) {
            RAF_X(this._timerID);
        } else {
            clearInterval(this._timerID);
        }
        this._timerID = 0;
    }

    get active(): boolean {
        return this._active;
    }

    get lastTimeStamp(): number {
        return this._lastTimeStamp + this._timeOffset;
    }

    get ticks(): ClockTick[] {
        return this._ticks;
    }

    // register callback.
    on(tick: ClockTick): void {
        if (!this.has(tick)) { // ignore already registered function.
            this._ticks.push(tick);
        }
    }

    // un register callback.
    off(tick: ClockTick): void {
        var pos = this._ticks.indexOf(tick);
        if (pos >= 0) {
            this._ticks[pos] = null;
        }
    }

    has(tick: ClockTick): boolean {
        return this._ticks.indexOf(tick) >= 0;
    }

    clear(): void {
        for (var i = 0, iz = this._ticks.length; i < iz; ++i) {
            this._ticks[i] = null;
        }
    }

    now(): number {
        return Date.now() - this._baseTime;
    }

    private  _shrink(): void { // @bind this
        var denseArray: ClockTick[] = [];
        for (var i = 0, iz = this._ticks.length; i < iz; ++i) {
            if (this._ticks[i]) {
                denseArray.push(this._ticks[i]);
            }
        }
        this._ticks = denseArray; // overwrite
    }

    // requestAnimationFrame give us timeStamp.
    private _enterFrame(highResTimeStamp: number) {
        if (!this._active) {
            return;
        }
        if (this._vsync) {
            this._timerID = RAF(this._bindingEnterFrame);
        }
        if (!this._ticks.length) {
            return;
        }

        // setInterval or setTimeout does not give us the highResTimeStamp.
        var timeStamp = (highResTimeStamp || Date.now()) - this._baseTime;
        var deltaTime = 0;     // elapsed time since the last frame.
        var garbage = false; // functions that are no longer needed.

        if (this._pulse) {
            // --- adjust timeStamp and deltaTime ---
            if (this._counter++) {
                timeStamp = this._pulse + this._lastTimeStamp;
            }
            deltaTime = this._pulse;
        } else {
            deltaTime = timeStamp - this._lastTimeStamp;
        }
        this._lastTimeStamp = timeStamp; // update lastTimeStamp
        timeStamp += this._timeOffset;

        // --- callback tick function ---
        for (var i = 0, iz = this._ticks.length; i < iz; ++i) {
            var tick = this._ticks[i];
            if (tick) {
                tick(timeStamp, deltaTime);
            } else {
                garbage = true;
            }
        }
        if (garbage) {
            this._shrink();
        }
    }
}
export = ClockCL;
