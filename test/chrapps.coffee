{processPackage} = require "../main"

describe "Chrapps", ->
  it "should chrapp all over the place", ->
    console.log processPackage(PACKAGE)
