Chrapps
=======

Chrappify a package to be a packaged Chrome App, or Chrapp (pronounced kræp).

To do this we take a package and process it into a Chrome App package.

Much of this code is lifted from http://github.com/STRd6/packager

We convert all the "files" into functions that can be executed instead of eval'd.

We need to do this so our `require` will continue to work in the Chrome app
security sandbox.

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

    stringifier = require("./stringifier")

Wrap code in a closure that provides the package and a require function. This
can be used for generating standalone HTML pages, scripts, and tests.

    packageWrapper = (pkg, code) ->
      """
        ;(function(PACKAGE) {
        var oldRequire = window.Require;
        #{PACKAGE.distribution.require.content}
        var require = Require.generateFor(PACKAGE);
        window.Require = oldRequire;
        #{code}
        })(#{stringifier(convertPackage(pkg))});
      """

    html = (pkg) ->
      """
        <!DOCTYPE html>
        <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        #{dependencyScripts(pkg.remoteDependencies)}
        </head>
        <body>
        <script src="/app.js"><\/script>
        </body>
        </html>
      """

    appJS = (pkg) ->
      packageWrapper(pkg, "require('./#{pkg.entryPoint}')")

Load the config from our app package.

    loadAppConfig = (pkg) ->
      module = {}
      Function("module", pkg.distribution.pixie.content)(module)
      return module.exports

`makeScript` returns a string representation of a script tag that has a src
attribute.

    makeScript = (src) ->
      "<script src=#{JSON.stringify(src)}><\/script>"

`dependencyScripts` returns a string containing the script tags that are
the remote script dependencies of this build.

    dependencyScripts = (remoteDependencies=[]) ->
      remoteDependencies.map(makeScript).join("\n")

Export our Chrapp processor.

    module.exports =
      processPackage: (pkg) ->
        files = []

        add = (path, content) ->
          files.push
            content: content
            mode: "100644"
            path: path
            type: "blob"

        add "background.js", generateBackgroundPage(pkg)
        add "window.html", html(pkg)
        add "app.js", appJS(pkg)
        add "manifest.json", generateManifest loadAppConfig(pkg)

        return files
