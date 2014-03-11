Chrapps
=======

Chrappify a package to be a packaged Chrome App, or Chrapp as they say in the
parlance of our times.

To do this we take a package and process it into a Chrome App package.

We convert all the "files" into functions that can be executed instead of eval'd.

    convertFile = (file) ->
      """
        function(require, global, module, exports, PACKAGE) {
          #{file.content};

          return module.exports;
        }
      """

    convertPackage = (pkg) ->
      {dependencies, distribution} = pkg

      dependencies: 
        Object.keys(dependencies).reduce (processed, key) ->
          processed[key] = convertPackage(dependencies[key])
          processed 
        , {}
      distribution: 
        Object.keys(distribution).reduce (processed, key) ->
          processed[key] = convertFile distribution[key]
          processed
        , {}

We provide our own modified [`require`](./require) that works with that .

We set up the `background.js` and anything else Chrapps need.

    generateBackgroundPage = (data) ->
      """
        chrome.app.runtime.onLaunched.addListener(function() {
          chrome.app.window.create('window.html', {
            'bounds': {
              'width': #{data.width},
              'height': #{data.height}
            }
          });
        });
      """

Generate `manifest.json`

    generateManifest = (data) ->
      data.app =
        background:
          scripts: ["background.js"]

      JSON.stringify(data)

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
          string = Object.keys(pkg).map (key) ->
            value = obj[key]
            "#{stringify(key)}:#{stringify(value)}"
          .join ","
  
          "{#{string}}"
        else
          "null"

    packageWrapper = (pkg) ->
      """
        ;(function(PACKAGE) {
        var oldRequire = window.Require;
        #{PACKAGE.distribution.require.content}
        var require = Require.generateFor(PACKAGE);
        window.Require = oldRequire;
        #{code}
        })(#{stringify(convertPackage(pkg))});
      """

    html = (pkg) ->
      """
        <!DOCTYPE html>
        <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        #{dependencyScripts(pkg.remoteDependencies)}
        </head>
        <body>
        <script>
        #{packageWrapper(pkg, "require('./#{pkg.entryPoint}')")}
        <\/script>
        </body>
        </html>
      """

    module.exports =
      processPackage: (pkg) ->
        files = []

        add = (path, content) ->
          files.push
            content: content
            mode: "100644"
            path: path
            type: "blob"

        processedPackage = convertPackage(pkg)
        
        