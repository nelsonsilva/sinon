(function (root) {
    "use strict";

    var buster = root.buster || require("buster");
    var sinon = root.sinon || require("../../lib/sinon");
    var assert = buster.assert;
    var refute = buster.refute;

    buster.testCase("sinon.fakeServerWithClock", {
        requiresSupportFor: {
            "browser": typeof window !== "undefined"
        },

        "without pre-existing fake clock": {
            setUp: function () {
                this.server = sinon.fakeServerWithClock.create();
            },

            tearDown: function () {
                this.server.restore();
                if (this.clock) {
                    this.clock.restore();
                }
            },

            "calls 'super' when adding requests": function () {
                var sandbox = sinon.sandbox.create();
                var addRequest = sandbox.stub(sinon.fakeServer, "addRequest");
                var xhr = {};
                this.server.addRequest(xhr);

                assert(addRequest.calledWith(xhr));
                assert(addRequest.calledOn(this.server));
                sandbox.restore();
            },

            "sets reference to clock when adding async request": function () {
                this.server.addRequest({ async: true });

                assert.isObject(this.server.clock);
                assert.isFunction(this.server.clock.tick);
            },

            "sets longest timeout from setTimeout": function () {
                this.server.addRequest({ async: true });

                setTimeout(function () {}, 12);
                setTimeout(function () {}, 29);
                setInterval(function () {}, 12);
                setTimeout(function () {}, 27);

                assert.equals(this.server.longestTimeout, 29);
            },

            "sets longest timeout from setInterval": function () {
                this.server.addRequest({ async: true });

                setTimeout(function () {}, 12);
                setTimeout(function () {}, 29);
                setInterval(function () {}, 132);
                setTimeout(function () {}, 27);

                assert.equals(this.server.longestTimeout, 132);
            },

            "resets clock": function () {
                this.server.addRequest({ async: true });

                this.server.respond("");
                assert.same(setTimeout, sinon.timers.setTimeout);
            },

            "does not reset clock second time": function () {
                this.server.addRequest({ async: true });
                this.server.respond("");
                this.clock = sinon.useFakeTimers();
                this.server.addRequest({ async: true });
                this.server.respond("");

                refute.same(setTimeout, sinon.timers.setTimeout);
            }
        },

        "existing clock": {
            setUp: function () {
                this.clock = sinon.useFakeTimers();
                this.server = sinon.fakeServerWithClock.create();
            },

            tearDown: function () {
                this.clock.restore();
                this.server.restore();
            },

            "uses existing clock": function () {
                this.server.addRequest({ async: true });

                assert.same(this.server.clock, this.clock);
            },

            "records longest timeout using setTimeout and existing clock": function () {
                this.server.addRequest({ async: true });

                setInterval(function () {}, 42);
                setTimeout(function () {}, 23);
                setTimeout(function () {}, 53);
                setInterval(function () {}, 12);

                assert.same(this.server.longestTimeout, 53);
            },

            "records longest timeout using setInterval and existing clock": function () {
                this.server.addRequest({ async: true });

                setInterval(function () {}, 92);
                setTimeout(function () {}, 73);
                setTimeout(function () {}, 53);
                setInterval(function () {}, 12);

                assert.same(this.server.longestTimeout, 92);
            },

            "does not reset clock": function () {
                this.server.respond("");

                assert.same(setTimeout.clock, this.clock);
            }
        },

        ".respond": {
            setUp: function () {
                this.server = sinon.fakeServerWithClock.create();
                this.server.addRequest({ async: true });
            },

            tearDown: function () {
                this.server.restore();
            },

            "ticks the clock to fire the longest timeout": function () {
                this.server.longestTimeout = 96;

                this.server.respond();

                assert.equals(this.server.clock.now, 96);
            },

            "ticks the clock to fire the longest timeout when multiple responds": function () {
                setInterval(function () {}, 13);
                this.server.respond();
                var xhr = new sinon.FakeXMLHttpRequest();
                // please the linter, we can't have unused variables
                // even when we're instantiating FakeXMLHttpRequest for it's side effects
                assert(xhr);
                setInterval(function () {}, 17);
                this.server.respond();

                assert.equals(this.server.clock.now, 17);
            },

            "resets longest timeout": function () {
                this.server.longestTimeout = 96;

                this.server.respond();

                assert.equals(this.server.longestTimeout, 0);
            },

            "calls original respond": function () {
                var obj = {};
                var respond = this.stub(sinon.fakeServer, "respond").returns(obj);

                var result = this.server.respond("GET", "/", "");

                assert.equals(result, obj);
                assert(respond.calledWith("GET", "/", ""));
                assert(respond.calledOn(this.server));
            }
        },

        "jQuery compat mode": {
            setUp: function () {
                this.server = sinon.fakeServerWithClock.create();

                this.request = new sinon.FakeXMLHttpRequest();
                this.request.open("get", "/", true);
                this.request.send();
                sinon.spy(this.request, "respond");
            },

            tearDown: function () {
                this.server.restore();
            },

            "handles clock automatically": function () {
                this.server.respondWith("OK");
                var spy = sinon.spy();

                setTimeout(spy, 13);
                this.server.respond();
                this.server.restore();

                assert(spy.called);
                assert.same(setTimeout, sinon.timers.setTimeout);
            },

            "finishes xhr from setInterval like jQuery 1.3.x does": function () {
                this.server.respondWith("Hello World");
                var xhr = new sinon.FakeXMLHttpRequest();
                xhr.open("GET", "/");
                xhr.send();

                var spy = sinon.spy();

                setInterval(function () {
                    spy(xhr.responseText, xhr.statusText, xhr);
                }, 13);

                this.server.respond();

                assert.equals(spy.args[0][0], "Hello World");
                assert.equals(spy.args[0][1], "OK");
                assert.equals(spy.args[0][2].status, 200);
            }
        }
    });
}(this));
