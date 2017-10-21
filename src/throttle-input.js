// @flow

import "rxjs";

import { Operator } from "rxjs/Operator";
import { Observable } from "rxjs/Observable";
import { Subscriber } from "rxjs/Subscriber";
import { Scheduler } from "rxjs/Scheduler";
import { Subscription } from "rxjs/Subscription";
import { async } from "rxjs/scheduler/async";


declare type Comparator<T> = ( next: T, previous: T ) => boolean; // eslint-disable-line no-undef

declare type ThrottleInputOptions<T, C> = {
    duration: number,
    filter?: Comparator<T>,
    throttleFilter?: Comparator<T>,
    cancellator?: Observable<C>,
    scheduler?: Scheduler
};

declare type Value<T> = {
    value: ?T
};

class ThrottleInputSubscriber<T, C> extends Subscriber<T> {

    duration: number;
    filter: ?Comparator<T>;
    throttleFilter: ?Comparator<T>;
    scheduler: Scheduler;
    throttled: Subscription | null;

    nextValue: ?Value<T>;
    previousValue: ?Value<T>;

    constructor( destination: Subscriber<T>, options: ThrottleInputOptions<T, C> ) {
        super( destination );
        this.duration = options.duration;
        this.filter = options.filter;
        this.throttleFilter = options.throttleFilter;
        this.scheduler = options.scheduler || async;

        this.throttled = null;

        this.resetValues();

        if ( options.cancellator )
            this.add( options.cancellator.subscribe( this.cancel ) );
    }

    _next( value: T ) {
        this.nextValue = { value };

        if ( this.throttled ) {
            if ( !this.throttleFilter )
                return;
            if ( this.previousValue && this.throttleFilter( value, ( this.previousValue.value: any ) ) )
                return;
            // situation when there is no previous value but observable is throttled seems weird
        }

        this.dispatchNext();
    }

    _complete() {
        this.dispatchNext( true );
        this.destination.complete();
    }

    dispatchNext( onComplete ) {
        this.clearThrottling();

        if ( !this.nextValue )
            return false;

        const dispatch = !this.previousValue
            || !this.filter
            || this.filter( ( this.nextValue.value: any ), ( this.previousValue.value: any ) )
        ;

        this.previousValue = this.nextValue;
        this.nextValue = null;

        if ( dispatch )
            this.destination.next( this.previousValue.value );

        if ( dispatch && !onComplete ) {
            this.throttled = this.scheduler.schedule( dispatchLast, this.duration, this );
            this.add( this.throttled );
        }
    }

    clearThrottling() {
        // saving in a local variable to please flow
        const throttled = this.throttled;
        if ( !throttled )
            return;

        this.remove( throttled );
        throttled.unsubscribe();
        this.throttled = null;
    }

    resetValues() {
        this.nextValue = null;
        this.previousValue = null;
    }

    cancel = (): void => {
        this.clearThrottling();
        this.resetValues();
    }

}

class ThrottleInputOperator<T, C> implements Operator<T, T> {

    options: ThrottleInputOptions<T, C>;

    constructor( options: ThrottleInputOptions<T, C> ) {
        this.options = options;
    }

    call( subscriber: Subscriber<T>, source: any ) {
        return source.subscribe( new ThrottleInputSubscriber( subscriber, this.options ) );
    }
}

function dispatchLast<T, C>( subscriber: ThrottleInputSubscriber<T, C> ) {
    subscriber.dispatchNext();
}

function throttleInput<T, C, R>( options: ThrottleInputOptions<T, C> ): Observable<R> {
    return this.lift( new ThrottleInputOperator( options ) );
}

// $FlowFixMe
Observable.prototype.throttleInput = throttleInput;// eslint-disable-line

export default throttleInput;
