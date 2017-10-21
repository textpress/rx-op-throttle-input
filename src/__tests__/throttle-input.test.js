/* eslint-disable no-multi-spaces */
import Rx from "rxjs";
import { TestScheduler } from "rxjs/testing/TestScheduler";
import {
    hot,
    cold,
    expectObservable as _expectObservable,
    expectSubscriptions as _expectSubscriptions
} from "@textpress/rx-marble-testing";
import "../throttle-input";
import matchers from "expect/build/matchers";
import visualizer from "@textpress/rx-marble-testing/lib/marble-ascii-visualizer"

global.rxTestScheduler = null;
const Observable = Rx.Observable;

function marbleToBe( received, marble ) {
    received.toBe( marble );
    try {
        const toEqual = matchers.toEqual.bind( expect );
        global.rxTestScheduler.assertDeepEqual = ( received, expected ) => {
            const result = toEqual( received, expected );
            if ( !result.pass ) {
                const error = new Error( "ASSERTION FAILED" );
                result.message = toEqual( visualizer( received ), visualizer( expected ) ).message;
                error.result = result;
                throw error;
            }
        };
        global.rxTestScheduler.flush();
    } catch ( x ) {
        if ( x.message === "ASSERTION FAILED" )
            return x.result;
        throw x;
    } finally {
        global.rxTestScheduler.assertDeepEqual = undefined;
    }
    return { pass: true };
}

expect.extend( {
    toBe: marbleToBe
} );

function expectObservable() {
    return expect( _expectObservable.apply( this, arguments ) );
}

function expectSubscriptions() {
    return expect( _expectSubscriptions.apply( this, arguments ) );
}

describe( "Observable.prototype.throttleInput", () => {
    let rxTestScheduler = null;
    beforeEach( () => {
        rxTestScheduler = new TestScheduler();
        global.rxTestScheduler = rxTestScheduler;
    } );

    it( "should emit first value immediately", () => {
        const e1 = hot(  "-a---|" );
        const e1subs =   "^    !";
        const expected = "-a---|";

        expectObservable( e1.throttleInput( { duration: 20, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
    } );

    it( "should throttle after first value for specified time", () => {
        const e1 = hot(  "-ab---|" );
        const e1subs =   "^     !";
        const expected = "-a--b-|";

        expectObservable( e1.throttleInput( { duration: 30, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
    } );

    it( "should stop throttling when source completes", () => {
        const e1 = hot(  "-ab-|" );
        const e1subs =   "^   !";
        const expected = "-a--(b|)";

        expectObservable( e1.throttleInput( { duration: 60, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
    } );

    it( "should emit only last value after throttling", () => {
        const e1 = hot(  "-abc--|" );
        const e1subs =   "^     !";
        const expected = "-a--c-|";

        expectObservable( e1.throttleInput( { duration: 30, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
    } );

    it( "should throttle all but first value in a group", () => {
        const e1 = hot(  "-(abc)--|" );
        const e1subs =   "^       !";
        const expected = "-a----c-|";

        expectObservable( e1.throttleInput( { duration: 50, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
    } );

    it( "should throttle next value after previous throttling finished", () => {
        const e1 = hot(  "-abc-d---|" );
        const e1subs =   "^        !";
        const expected = "-a--c--d-|";

        expectObservable( e1.throttleInput( { duration: 30, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
    } );

    it( "should throttle after all not throttled values", () => {
        const e1 = hot(  "-a--b-----c-d----efg|" );
        const e1subs =   "^                   !";
        const expected = "-a----b----c----d---(g|)";

        expectObservable( e1.throttleInput( { duration: 50, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
    } );


    it( "should complete when source does not emit", () => {
        const e1 = hot(  "-----|" );
        const e1subs =   "^    !";
        const expected = "-----|";

        expectObservable( e1.throttleInput( { duration: 10, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
    } );

    it( "should complete when source is empty", () => {
        const e1 = cold( "|" );
        const e1subs =  "(^!)";
        const expected = "|";

        expectObservable( e1.throttleInput( { duration: 10, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
    } );

    it( "should raise error when source does not emit and raises error", () => {
        const e1 = hot(  "-----#" );
        const e1subs =   "^    !";
        const expected = "-----#";

        expectObservable( e1.throttleInput( { duration: 10, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
    } );

    it( "should raise error when source throws", () => {
        const e1 = cold( "#" );
        const e1subs =  "(^!)";
        const expected = "#";

        expectObservable( e1.throttleInput( { duration: 10, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
    } );

    it( "should allow unsubscribing early and explicitly", () => {
        const e1 = hot(  "--a--bc--d----|" );
        const e1subs =   "^      !       ";
        const expected = "--a--b--       ";
        const unsub =    "       !       ";

        const result = e1.throttleInput( { duration: 20, scheduler: rxTestScheduler } );

        expectObservable( result, unsub ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
    } );

    it( "should not break unsubscription chains when unsubscribed explicitly", () => {
        const e1 = hot(  "--a--bc--d----|" );
        const e1subs =   "^      !       ";
        const expected = "--a--b--       ";
        const unsub =    "       !       ";

        const result = e1
            .mergeMap( x => Observable.of( x ) )
            .throttleInput( { duration: 20, scheduler: rxTestScheduler } )
            .mergeMap( x => Observable.of( x ) )
        ;

        expectObservable( result, unsub ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
    } );

    it( "should throttle and does not complete when source does not complete", () => {
        const e1 = hot(  "-a--(bc)------d-----f-----" );
        const e1subs =   "^                         ";
        const expected = "-a-------c-------d-------f";

        expectObservable( e1.throttleInput( { duration: 80, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
    } );

    it( "should not complete when source does not completes", () => {
        const e1 = hot(  "-" );
        const e1subs =   "^";
        const expected = "-";

        expectObservable( e1.throttleInput( { duration: 10, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
    } );

    it( "should not complete when source never completes", () => {
        const e1 = cold( "-" );
        const e1subs =   "^";
        const expected = "-";

        expectObservable( e1.throttleInput( { duration: 10, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
    } );

    it( "should throttle until source raises error", () => {
        const e1 = hot(  "-a-b----c---d-e---f-#" );
        const e1subs =   "^                   !";
        const expected = "-a----b----c----e---#";

        expectObservable( e1.throttleInput( { duration: 50, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
    } );

    it( "should throttle all elements while source emits within given time", () => {
        const e1 = hot(  "--a--b--c--d--e--f--g--h--|" );
        const e1subs =   "^                         !";
        const expected = "--a-----------------------(h|)";

        expectObservable( e1.throttleInput( { duration: 250, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
    } );

    it( "should throttle all element while source emits within given time until raises error", () => {
        const e1 = hot(  "--a--b--c--d--e--f--g--h-#" );
        const e1subs =   "^                        !";
        const expected = "--a----------------------#";

        expectObservable( e1.throttleInput( { duration: 300, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
    } );

    it( "should cancel throttling", () => {
        const e1 = hot(  "--a--b-----|" );
        const e1subs =   "^          !";
        const e2 = hot(  "-------z---|" );
        const e2subs =   "^          !";
        const expected = "--a--------|";

        expectObservable( e1.throttleInput( { duration: 70, cancellator: e2, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
        expectSubscriptions( e2.subscriptions ).toBe( e2subs );
    } );

    it( "should continue to work after cancellation", () => {
        const e1 = hot(  "--a--b--c--|" );
        const e1subs =   "^          !";
        const e2 = hot(  "-------z---|" );
        const e2subs =   "^          !";
        const expected = "--a-----c--|";

        expectObservable( e1.throttleInput( { duration: 70, cancellator: e2, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
        expectSubscriptions( e2.subscriptions ).toBe( e2subs );
    } );

    it( "should work with multiple cancellations", () => {
        const e1 = hot(  "--a--b--c-d-e---f------|" );
        const e1subs =   "^                      !";
        const e2 = hot(  "-------z---z-----------|" );
        const e2subs =   "^                      !";
        const expected = "--a-----c---e------f---|";

        expectObservable( e1.throttleInput( { duration: 70, cancellator: e2, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
        expectSubscriptions( e2.subscriptions ).toBe( e2subs );
    } );

    it( "should continue to work when cancellation stops", () => {
        const e1 = hot(  "--a--b--c-d-e---f-------|" );
        const e1subs =   "^                       !";
        const e2 = hot(  "-------z-|" );
        const e2subs =   "^        !";
        const expected = "--a-----c------e------f-|";

        expectObservable( e1.throttleInput( { duration: 70, cancellator: e2, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
        expectSubscriptions( e2.subscriptions ).toBe( e2subs );
    } );

    it( "should not sink same consequent events if filter is not specified", () => {
        const e1 = hot(  "--aaaaaaaa--|" );
        const e1subs =   "^           !";
        const expected = "--a-a-a-a-a-|";

        expectObservable( e1.throttleInput( { duration: 20, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
    } );

    it( "should sink same consequent events if filter is provided", () => {
        const e1 = hot(  "--aaaaaaaa-b-|" );
        const e1subs =   "^            !";
        const expected = "--a--------b-|";

        expectObservable( e1.throttleInput( { duration: 20, filter: ( n, p ) => n !== p, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
    } );

    it( "should not start throttling from sinked events", () => {
        const e1 = hot(  "--a---ab--|" );
        const e1subs =   "^         !";
        const expected = "--a----b--|";

        expectObservable( e1.throttleInput( { duration: 30, filter: ( n, p ) => n !== p, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
    } );

    it( "should cancel sinking same events", () => {
        const e1 = hot(  "--aaaaaaaaaab-|" );
        const e1subs =   "^             !";
        const e2 = hot(  "-------z------|" );
        const e2subs =   "^             !";
        const expected = "--a-----a---b-|";

        expectObservable( e1.throttleInput( { duration: 20, filter: ( n, p ) => n !== p, cancellator: e2, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
        expectSubscriptions( e2.subscriptions ).toBe( e2subs );
    } );

    it( "should obey throttle filter", () => {
        const e1 = hot(  "-a-ba--babc----|" );
        const e1subs =   "^              !";
        const expected = "-a-ba--bab---c-|";

        const throttleFilter = ( next, previous ) => {
            if ( next === "b" )
                return false;
            return previous !== "b" || next === "c";
        };

        expectObservable( e1.throttleInput( { duration: 40, filter: ( n, p ) => n !== p, throttleFilter: throttleFilter, scheduler: rxTestScheduler } ) ).toBe( expected );
        expectSubscriptions( e1.subscriptions ).toBe( e1subs );
    } );

} );
