stringifier = require "../stringifier"

describe "stringifier", ->
  it "should generally stringify stuff", ->
    assert.equal JSON.parse(stringifier(2)), 2
    assert.equal JSON.parse(stringifier("3")), "3"
    assert.equal JSON.parse(stringifier({a: {b: "c"}})).a.b, "c"

  it "should do that function madness", ->
    obj =
      fn: """
        function(require, global, module, exports, PACKAGE) {
          console.log("I'm in the function")
        }
      """

    result = stringifier(obj)

    console.log result

    fn = eval("(#{result})").fn

    assert.equal typeof fn, "function"
