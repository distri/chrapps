Stringifier
===========

A hacky stringifier that makes "almost" JSON.

    stringify = (data) ->
      if stringifier = stringifiers[typeof data]
        stringifier(data)
      else
        JSON.stringify(data)

    stringifiers =
      undefined: ->
        "undefined"
      string: (string) ->
        # One weird trick to psuedo-stringify but keep special functions as functions
        if string.match /^function\(require, global, module, exports, PACKAGE\)/
          string
        else
          JSON.stringify(string)
      object: (obj) ->
        if obj
          string = Object.keys(obj).map (key) ->
            value = obj[key]
            "#{stringify(key)}:#{stringify(value)}"
          .join ","

          "{#{string}}"
        else
          "null"

    module.exports = stringify
