(function(pkg) {
  // Expose a require for our package so scripts can access our modules
  window.require = Require.generateFor(pkg);
})({
  "source": {
    "LICENSE": {
      "path": "LICENSE",
      "mode": "100644",
      "content": "The MIT License (MIT)\n\nCopyright (c) 2014 \n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.",
      "type": "blob"
    },
    "README.md": {
      "path": "README.md",
      "mode": "100644",
      "content": "chrapps\n=======\n\nPackage crappy apps as Chrome Apps\n",
      "type": "blob"
    },
    "main.coffee.md": {
      "path": "main.coffee.md",
      "mode": "100644",
      "content": "Chrapps\n=======\n\nChrappify a package to be a packaged Chrome App, or Chrapp (pronounced kræp).\n\nTo do this we take a package and process it into a Chrome App package.\n\nMuch of this code is lifted from http://github.com/STRd6/packager\n\nWe convert all the \"files\" into functions that can be executed instead of eval'd.\n\nWe need to do this so our `require` will continue to work in the Chrome app\nsecurity sandbox.\n\n    convertFile = (file) ->\n      \"\"\"\n        function(require, global, module, exports, PACKAGE) {\n          #{file.content};\n\n          return module.exports;\n        }\n      \"\"\"\n\n    convertPackage = (pkg) ->\n      {dependencies, distribution} = pkg\n\n      result = extend {}, pkg,\n        dependencies: \n          Object.keys(dependencies).reduce (processed, key) ->\n            processed[key] = convertPackage(dependencies[key])\n            processed \n          , {}\n        distribution: \n          Object.keys(distribution).reduce (processed, key) ->\n            processed[key] = convertFile distribution[key]\n            processed\n          , {}\n\nWe provide our own modified [`require`](./require) that works with that .\n\nWe set up the `background.js` and anything else Chrapps need.\n\n    generateBackgroundPage = (data) ->\n      \"\"\"\n        chrome.app.runtime.onLaunched.addListener(function() {\n          chrome.app.window.create('window.html', {\n            'bounds': {\n              'width': #{data.width},\n              'height': #{data.height}\n            }\n          });\n        });\n      \"\"\"\n\nGenerate `manifest.json`\n\n    generateManifest = (data) ->\n      data.app =\n        background:\n          scripts: [\"background.js\"]\n\n      JSON.stringify(data)\n\n    stringifier = require(\"./stringifier\")\n\nWrap code in a closure that provides the package and a require function. This\ncan be used for generating standalone HTML pages, scripts, and tests.\n\n    packageWrapper = (pkg, code) ->\n      \"\"\"\n        ;(function(PACKAGE) {\n        var oldRequire = window.Require;\n        #{PACKAGE.distribution.require.content}\n        var require = Require.generateFor(PACKAGE);\n        window.Require = oldRequire;\n        #{code}\n        })(#{stringifier(convertPackage(pkg))});\n      \"\"\"\n\n    html = (pkg) ->\n      \"\"\"\n        <!DOCTYPE html>\n        <head>\n        <meta http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\" />\n        #{dependencyScripts(pkg.remoteDependencies)}\n        </head>\n        <body>\n        <script src=\"./app.js\"><\\/script>\n        </body>\n        </html>\n      \"\"\"\n\n    appJS = (pkg) ->\n      packageWrapper(pkg, \"require('./#{pkg.entryPoint}')\")\n\nLoad the config from our app package.\n\n    loadAppConfig = (pkg) ->\n      module = {}\n      Function(\"module\", pkg.distribution.pixie.content)(module)\n      return module.exports\n\n`makeScript` returns a string representation of a script tag that has a src\nattribute.\n\n    makeScript = (src) ->\n      \"<script src=#{JSON.stringify(src)}><\\/script>\"\n\n`dependencyScripts` returns a string containing the script tags that are\nthe remote script dependencies of this build.\n\n    dependencyScripts = (remoteDependencies=[]) ->\n      remoteDependencies.map(makeScript).join(\"\\n\")\n\nExport our Chrapp processor.\n\n    module.exports =\n      processPackage: (pkg) ->\n        files = []\n\n        add = (path, content) ->\n          files.push\n            content: content\n            mode: \"100644\"\n            path: path\n            type: \"blob\"\n\n        # TODO: Add all external dependencies as libs\n\n        add \"window.html\", html(pkg)\n        add \"app.js\", appJS(pkg)\n        add \"background.js\", generateBackgroundPage loadAppConfig(pkg)\n        add \"manifest.json\", generateManifest loadAppConfig(pkg)\n\n        return files\n\nExtend helper\n\n    extend = (target, sources...) ->\n      for source in sources\n        for name of source\n          target[name] = source[name]\n  \n      return target\n",
      "type": "blob"
    },
    "require.coffee.md": {
      "path": "require.coffee.md",
      "mode": "100644",
      "content": "Require\n=======\n\nNOTE: This is a slightly modified version of http://github.com/STRd6/require\n\nA Node.js compatible require implementation for pure client side apps.\n\nEach file is a module. Modules are responsible for exporting an object. Unlike\ntraditional client side JavaScript, Ruby, or other common languages the module\nis not responsible for naming its product in the context of the requirer. This\nmaintains encapsulation because it is impossible from within a module to know\nwhat external name would be correct to prevent errors of composition in all\npossible uses.\n\nDefinitions\n-----------\n\n### Module\n\nA module is a file.\n\n### Package\n\nA package is an aggregation of modules. A package is a json object with the\nfollowing properties:\n\n- `distribution` An object whose keys are paths and properties are `fileData`\n- `entryPoint` Path to the primary module that requiring this package will require.\n- `dependencies` An object whose keys are names and whose values are packages.\n\nIt may have additional properties such as `source`, `repository`, and `docs`.\n\n### Application\n\nAn application is a package which has an `entryPoint` and may have dependencies.\nAdditionally an application's dependencies may have dependencies. Dependencies\nmust be bundled with the package.\n\nUses\n----\n\nFrom a module require another module in the same package.\n\n>     require \"./soup\"\n\nRequire a module in the parent directory\n\n>     require \"../nuts\"\n\nRequire a module from the root directory in the same package.\n\nNOTE: This could behave slightly differently under Node.js if your package does\nnot have it's own jailed filesystem.\n\n>     require \"/silence\"\n\nFrom a module within a package, require a dependent package.\n\n>     require \"console\"\n\nThe dependency will be delcared something like\n\n>     dependencies:\n>       console: \"http://strd6.github.io/console/v1.2.2.json\"\n\nImplementation\n--------------\n\nFile separator is '/'\n\n    fileSeparator = '/'\n\nIn the browser `global` is `window`.\n\n    global = window\n\nDefault entry point\n\n    defaultEntryPoint = \"main\"\n\nA sentinal against circular requires.\n\n    circularGuard = {}\n\nA top-level module so that all other modules won't have to be orphans.\n\n    rootModule =\n      path: \"\"\n\nRequire a module given a path within a package. Each file is its own separate\nmodule. An application is composed of packages.\n\n    loadPath = (parentModule, pkg, path) ->\n      if startsWith(path, '/')\n        localPath = []\n      else\n        localPath = parentModule.path.split(fileSeparator)\n\n      normalizedPath = normalizePath(path, localPath)\n\n      cache = cacheFor(pkg)\n\n      if module = cache[normalizedPath]\n        if module is circularGuard\n          throw \"Circular dependency detected when requiring #{normalizedPath}\"\n      else\n        cache[normalizedPath] = circularGuard\n\n        try\n          cache[normalizedPath] = module = loadModule(pkg, normalizedPath)\n        finally\n          delete cache[normalizedPath] if cache[normalizedPath] is circularGuard\n\n      return module.exports\n\nTo normalize the path we convert local paths to a standard form that does not\ncontain an references to current or parent directories.\n\n    normalizePath = (path, base=[]) ->\n      base = base.concat path.split(fileSeparator)\n      result = []\n\nChew up all the pieces into a standardized path.\n\n      while base.length\n        switch piece = base.shift()\n          when \"..\"\n            result.pop()\n          when \"\", \".\"\n            # Skip\n          else\n            result.push(piece)\n\n      return result.join(fileSeparator)\n\n`loadPackage` Loads a dependent package at that packages entry point.\n\n    loadPackage = (parentModule, pkg) ->\n      path = pkg.entryPoint or defaultEntryPoint\n\n      loadPath(parentModule, pkg, path)\n\nLoad a program from within a package.\n\n    loadModule = (pkg, path) ->\n      unless (program = pkg.distribution[path])\n        throw \"Could not find program at #{path} in #{pkg.name}\"\n\n      dirname = path.split(fileSeparator)[0...-1].join(fileSeparator)\n\n      module =\n        path: dirname\n        exports: {}\n\nThis external context provides some variable that modules have access to.\n\nA `require` function is exposed to modules so they may require other modules.\n\nAdditional properties such as a reference to the global object and some metadata\nare also exposed.\n\n      context =\n        require: generateRequireFn(pkg, module)\n        global: global\n        module: module\n        exports: module.exports\n        PACKAGE: pkg\n\n      args = Object.keys(context)\n      values = args.map (name) -> context[name]\n\nExecute the program within the module and given context.\n\n      program.apply(module, values)\n\n      return module\n\nHelper to detect if a given path is a package.\n\n    isPackage = (path) ->\n      if !(startsWith(path, fileSeparator) or\n        startsWith(path, \".#{fileSeparator}\") or\n        startsWith(path, \"..#{fileSeparator}\")\n      )\n        path.split(fileSeparator)[0]\n      else\n        false\n\nGenerate a require function for a given module in a package.\n\nIf we are loading a package in another module then we strip out the module part\nof the name and use the `rootModule` rather than the local module we came from.\nThat way our local path won't affect the lookup path in another package.\n\nLoading a module within our package, uses the requiring module as a parent for\nlocal path resolution.\n\n    generateRequireFn = (pkg, module=rootModule) ->\n      pkg.name ?= \"ROOT\"\n\n      (path) ->\n        if isPackage(path)\n          unless otherPackage = pkg.dependencies[path]\n            throw \"Package: #{path} not found.\"\n\n          otherPackage.name ?= path\n\n          loadPackage(rootModule, otherPackage)\n        else\n          loadPath(module, pkg, path)\n\nBecause we can't actually `require('require')` we need to export it a little\ndifferently.\n\n    if exports?\n      exports.generateFor = generateRequireFn\n    else\n      global.Require =\n        generateFor: generateRequireFn\n\nNotes\n-----\n\nWe have to use `pkg` as a variable name because `package` is a reserved word.\n\nNode needs to check file extensions, but because we only load compiled products\nwe never have extensions in our path.\n\nSo while Node may need to check for either `path/somefile.js` or `path/somefile.coffee`\nthat will already have been resolved for us and we will only check `path/somefile`\n\nCircular dependencies are not allowed and raise an exception when detected.\n\nHelpers\n-------\n\nDetect if a string starts with a given prefix.\n\n    startsWith = (string, prefix) ->\n      string.lastIndexOf(prefix, 0) is 0\n\nCreates a cache for modules within a package. It uses `defineProperty` so that\nthe cache doesn't end up being enumerated or serialized to json.\n\n    cacheFor = (pkg) ->\n      return pkg.cache if pkg.cache\n\n      Object.defineProperty pkg, \"cache\",\n        value: {}\n\n      return pkg.cache\n",
      "type": "blob"
    },
    "test/stringifier.coffee": {
      "path": "test/stringifier.coffee",
      "mode": "100644",
      "content": "stringifier = require \"../stringifier\"\n\ndescribe \"stringifier\", ->\n  it \"should generally stringify stuff\", ->\n    assert.equal JSON.parse(stringifier(2)), 2\n    assert.equal JSON.parse(stringifier(\"3\")), \"3\"\n    assert.equal JSON.parse(stringifier({a: {b: \"c\"}})).a.b, \"c\"\n\n  it \"should do that function madness\", ->\n    obj =\n      fn: \"\"\"\n        function(require, global, module, exports, PACKAGE) {\n          console.log(\"I'm in the function\")\n        }\n      \"\"\"\n\n    result = stringifier(obj)\n\n    console.log result\n\n    fn = eval(\"(#{result})\").fn\n    \n    assert.equal typeof fn, \"function\"\n",
      "type": "blob"
    },
    "stringifier.coffee.md": {
      "path": "stringifier.coffee.md",
      "mode": "100644",
      "content": "Stringifier\n===========\n\nA hacky stringifier that makes \"almost\" JSON.\n\n    stringify = (data) ->\n      if stringifier = stringifiers[typeof data]\n        stringifier(data)\n      else\n        JSON.stringify(data)\n\n    stringifiers =\n      undefined: ->\n        \"undefined\"\n      string: (string) ->\n        # One weird trick to psuedo-stringify but keep special functions as functions\n        if string.match /^function\\(require, global, module, exports, PACKAGE\\)/\n          string\n        else\n          JSON.stringify(string)\n      object: (obj) ->\n        if obj\n          string = Object.keys(obj).map (key) ->\n            value = obj[key]\n            \"#{stringify(key)}:#{stringify(value)}\"\n          .join \",\"\n  \n          \"{#{string}}\"\n        else\n          \"null\"\n\n    module.exports = stringify\n",
      "type": "blob"
    },
    "test/chrapps.coffee": {
      "path": "test/chrapps.coffee",
      "mode": "100644",
      "content": "{processPackage} = require \"../main\"\n\ndescribe \"Chrapps\", ->\n  it \"should chrapp all over the place\", ->\n    console.log processPackage(PACKAGE)\n",
      "type": "blob"
    },
    "pixie.cson": {
      "path": "pixie.cson",
      "mode": "100644",
      "content": "name: \"Chrapps\"\nversion: \"0.1.0-alpha.3\"\n",
      "type": "blob"
    }
  },
  "distribution": {
    "main": {
      "path": "main",
      "content": "(function() {\n  var appJS, convertFile, convertPackage, dependencyScripts, extend, generateBackgroundPage, generateManifest, html, loadAppConfig, makeScript, packageWrapper, stringifier,\n    __slice = [].slice;\n\n  convertFile = function(file) {\n    return \"function(require, global, module, exports, PACKAGE) {\\n  \" + file.content + \";\\n\\n  return module.exports;\\n}\";\n  };\n\n  convertPackage = function(pkg) {\n    var dependencies, distribution, result;\n    dependencies = pkg.dependencies, distribution = pkg.distribution;\n    return result = extend({}, pkg, {\n      dependencies: Object.keys(dependencies).reduce(function(processed, key) {\n        processed[key] = convertPackage(dependencies[key]);\n        return processed;\n      }, {}),\n      distribution: Object.keys(distribution).reduce(function(processed, key) {\n        processed[key] = convertFile(distribution[key]);\n        return processed;\n      }, {})\n    });\n  };\n\n  generateBackgroundPage = function(data) {\n    return \"chrome.app.runtime.onLaunched.addListener(function() {\\n  chrome.app.window.create('window.html', {\\n    'bounds': {\\n      'width': \" + data.width + \",\\n      'height': \" + data.height + \"\\n    }\\n  });\\n});\";\n  };\n\n  generateManifest = function(data) {\n    data.app = {\n      background: {\n        scripts: [\"background.js\"]\n      }\n    };\n    return JSON.stringify(data);\n  };\n\n  stringifier = require(\"./stringifier\");\n\n  packageWrapper = function(pkg, code) {\n    return \";(function(PACKAGE) {\\nvar oldRequire = window.Require;\\n\" + PACKAGE.distribution.require.content + \"\\nvar require = Require.generateFor(PACKAGE);\\nwindow.Require = oldRequire;\\n\" + code + \"\\n})(\" + (stringifier(convertPackage(pkg))) + \");\";\n  };\n\n  html = function(pkg) {\n    return \"<!DOCTYPE html>\\n<head>\\n<meta http-equiv=\\\"Content-Type\\\" content=\\\"text/html; charset=UTF-8\\\" />\\n\" + (dependencyScripts(pkg.remoteDependencies)) + \"\\n</head>\\n<body>\\n<script src=\\\"./app.js\\\"><\\/script>\\n</body>\\n</html>\";\n  };\n\n  appJS = function(pkg) {\n    return packageWrapper(pkg, \"require('./\" + pkg.entryPoint + \"')\");\n  };\n\n  loadAppConfig = function(pkg) {\n    var module;\n    module = {};\n    Function(\"module\", pkg.distribution.pixie.content)(module);\n    return module.exports;\n  };\n\n  makeScript = function(src) {\n    return \"<script src=\" + (JSON.stringify(src)) + \"><\\/script>\";\n  };\n\n  dependencyScripts = function(remoteDependencies) {\n    if (remoteDependencies == null) {\n      remoteDependencies = [];\n    }\n    return remoteDependencies.map(makeScript).join(\"\\n\");\n  };\n\n  module.exports = {\n    processPackage: function(pkg) {\n      var add, files;\n      files = [];\n      add = function(path, content) {\n        return files.push({\n          content: content,\n          mode: \"100644\",\n          path: path,\n          type: \"blob\"\n        });\n      };\n      add(\"window.html\", html(pkg));\n      add(\"app.js\", appJS(pkg));\n      add(\"background.js\", generateBackgroundPage(loadAppConfig(pkg)));\n      add(\"manifest.json\", generateManifest(loadAppConfig(pkg)));\n      return files;\n    }\n  };\n\n  extend = function() {\n    var name, source, sources, target, _i, _len;\n    target = arguments[0], sources = 2 <= arguments.length ? __slice.call(arguments, 1) : [];\n    for (_i = 0, _len = sources.length; _i < _len; _i++) {\n      source = sources[_i];\n      for (name in source) {\n        target[name] = source[name];\n      }\n    }\n    return target;\n  };\n\n}).call(this);\n\n//# sourceURL=main.coffee",
      "type": "blob"
    },
    "require": {
      "path": "require",
      "content": "(function() {\n  var cacheFor, circularGuard, defaultEntryPoint, fileSeparator, generateRequireFn, global, isPackage, loadModule, loadPackage, loadPath, normalizePath, rootModule, startsWith;\n\n  fileSeparator = '/';\n\n  global = window;\n\n  defaultEntryPoint = \"main\";\n\n  circularGuard = {};\n\n  rootModule = {\n    path: \"\"\n  };\n\n  loadPath = function(parentModule, pkg, path) {\n    var cache, localPath, module, normalizedPath;\n    if (startsWith(path, '/')) {\n      localPath = [];\n    } else {\n      localPath = parentModule.path.split(fileSeparator);\n    }\n    normalizedPath = normalizePath(path, localPath);\n    cache = cacheFor(pkg);\n    if (module = cache[normalizedPath]) {\n      if (module === circularGuard) {\n        throw \"Circular dependency detected when requiring \" + normalizedPath;\n      }\n    } else {\n      cache[normalizedPath] = circularGuard;\n      try {\n        cache[normalizedPath] = module = loadModule(pkg, normalizedPath);\n      } finally {\n        if (cache[normalizedPath] === circularGuard) {\n          delete cache[normalizedPath];\n        }\n      }\n    }\n    return module.exports;\n  };\n\n  normalizePath = function(path, base) {\n    var piece, result;\n    if (base == null) {\n      base = [];\n    }\n    base = base.concat(path.split(fileSeparator));\n    result = [];\n    while (base.length) {\n      switch (piece = base.shift()) {\n        case \"..\":\n          result.pop();\n          break;\n        case \"\":\n        case \".\":\n          break;\n        default:\n          result.push(piece);\n      }\n    }\n    return result.join(fileSeparator);\n  };\n\n  loadPackage = function(parentModule, pkg) {\n    var path;\n    path = pkg.entryPoint || defaultEntryPoint;\n    return loadPath(parentModule, pkg, path);\n  };\n\n  loadModule = function(pkg, path) {\n    var args, context, dirname, module, program, values;\n    if (!(program = pkg.distribution[path])) {\n      throw \"Could not find program at \" + path + \" in \" + pkg.name;\n    }\n    dirname = path.split(fileSeparator).slice(0, -1).join(fileSeparator);\n    module = {\n      path: dirname,\n      exports: {}\n    };\n    context = {\n      require: generateRequireFn(pkg, module),\n      global: global,\n      module: module,\n      exports: module.exports,\n      PACKAGE: pkg\n    };\n    args = Object.keys(context);\n    values = args.map(function(name) {\n      return context[name];\n    });\n    program.apply(module, values);\n    return module;\n  };\n\n  isPackage = function(path) {\n    if (!(startsWith(path, fileSeparator) || startsWith(path, \".\" + fileSeparator) || startsWith(path, \"..\" + fileSeparator))) {\n      return path.split(fileSeparator)[0];\n    } else {\n      return false;\n    }\n  };\n\n  generateRequireFn = function(pkg, module) {\n    if (module == null) {\n      module = rootModule;\n    }\n    if (pkg.name == null) {\n      pkg.name = \"ROOT\";\n    }\n    return function(path) {\n      var otherPackage;\n      if (isPackage(path)) {\n        if (!(otherPackage = pkg.dependencies[path])) {\n          throw \"Package: \" + path + \" not found.\";\n        }\n        if (otherPackage.name == null) {\n          otherPackage.name = path;\n        }\n        return loadPackage(rootModule, otherPackage);\n      } else {\n        return loadPath(module, pkg, path);\n      }\n    };\n  };\n\n  if (typeof exports !== \"undefined\" && exports !== null) {\n    exports.generateFor = generateRequireFn;\n  } else {\n    global.Require = {\n      generateFor: generateRequireFn\n    };\n  }\n\n  startsWith = function(string, prefix) {\n    return string.lastIndexOf(prefix, 0) === 0;\n  };\n\n  cacheFor = function(pkg) {\n    if (pkg.cache) {\n      return pkg.cache;\n    }\n    Object.defineProperty(pkg, \"cache\", {\n      value: {}\n    });\n    return pkg.cache;\n  };\n\n}).call(this);\n\n//# sourceURL=require.coffee",
      "type": "blob"
    },
    "test/stringifier": {
      "path": "test/stringifier",
      "content": "(function() {\n  var stringifier;\n\n  stringifier = require(\"../stringifier\");\n\n  describe(\"stringifier\", function() {\n    it(\"should generally stringify stuff\", function() {\n      assert.equal(JSON.parse(stringifier(2)), 2);\n      assert.equal(JSON.parse(stringifier(\"3\")), \"3\");\n      return assert.equal(JSON.parse(stringifier({\n        a: {\n          b: \"c\"\n        }\n      })).a.b, \"c\");\n    });\n    return it(\"should do that function madness\", function() {\n      var fn, obj, result;\n      obj = {\n        fn: \"function(require, global, module, exports, PACKAGE) {\\n  console.log(\\\"I'm in the function\\\")\\n}\"\n      };\n      result = stringifier(obj);\n      console.log(result);\n      fn = eval(\"(\" + result + \")\").fn;\n      return assert.equal(typeof fn, \"function\");\n    });\n  });\n\n}).call(this);\n\n//# sourceURL=test/stringifier.coffee",
      "type": "blob"
    },
    "stringifier": {
      "path": "stringifier",
      "content": "(function() {\n  var stringifiers, stringify;\n\n  stringify = function(data) {\n    var stringifier;\n    if (stringifier = stringifiers[typeof data]) {\n      return stringifier(data);\n    } else {\n      return JSON.stringify(data);\n    }\n  };\n\n  stringifiers = {\n    undefined: function() {\n      return \"undefined\";\n    },\n    string: function(string) {\n      if (string.match(/^function\\(require, global, module, exports, PACKAGE\\)/)) {\n        return string;\n      } else {\n        return JSON.stringify(string);\n      }\n    },\n    object: function(obj) {\n      var string;\n      if (obj) {\n        string = Object.keys(obj).map(function(key) {\n          var value;\n          value = obj[key];\n          return \"\" + (stringify(key)) + \":\" + (stringify(value));\n        }).join(\",\");\n        return \"{\" + string + \"}\";\n      } else {\n        return \"null\";\n      }\n    }\n  };\n\n  module.exports = stringify;\n\n}).call(this);\n\n//# sourceURL=stringifier.coffee",
      "type": "blob"
    },
    "test/chrapps": {
      "path": "test/chrapps",
      "content": "(function() {\n  var processPackage;\n\n  processPackage = require(\"../main\").processPackage;\n\n  describe(\"Chrapps\", function() {\n    return it(\"should chrapp all over the place\", function() {\n      return console.log(processPackage(PACKAGE));\n    });\n  });\n\n}).call(this);\n\n//# sourceURL=test/chrapps.coffee",
      "type": "blob"
    },
    "pixie": {
      "path": "pixie",
      "content": "module.exports = {\"name\":\"Chrapps\",\"version\":\"0.1.0-alpha.3\"};",
      "type": "blob"
    }
  },
  "progenitor": {
    "url": "http://strd6.github.io/editor/"
  },
  "version": "0.1.0-alpha.3",
  "entryPoint": "main",
  "repository": {
    "id": 17644489,
    "name": "chrapps",
    "full_name": "distri/chrapps",
    "owner": {
      "login": "distri",
      "id": 6005125,
      "avatar_url": "https://gravatar.com/avatar/192f3f168409e79c42107f081139d9f3?d=https%3A%2F%2Fidenticons.github.com%2Ff90c81ffc1498e260c820082f2e7ca5f.png&r=x",
      "gravatar_id": "192f3f168409e79c42107f081139d9f3",
      "url": "https://api.github.com/users/distri",
      "html_url": "https://github.com/distri",
      "followers_url": "https://api.github.com/users/distri/followers",
      "following_url": "https://api.github.com/users/distri/following{/other_user}",
      "gists_url": "https://api.github.com/users/distri/gists{/gist_id}",
      "starred_url": "https://api.github.com/users/distri/starred{/owner}{/repo}",
      "subscriptions_url": "https://api.github.com/users/distri/subscriptions",
      "organizations_url": "https://api.github.com/users/distri/orgs",
      "repos_url": "https://api.github.com/users/distri/repos",
      "events_url": "https://api.github.com/users/distri/events{/privacy}",
      "received_events_url": "https://api.github.com/users/distri/received_events",
      "type": "Organization",
      "site_admin": false
    },
    "private": false,
    "html_url": "https://github.com/distri/chrapps",
    "description": "Package crappy apps as Chrome Apps",
    "fork": false,
    "url": "https://api.github.com/repos/distri/chrapps",
    "forks_url": "https://api.github.com/repos/distri/chrapps/forks",
    "keys_url": "https://api.github.com/repos/distri/chrapps/keys{/key_id}",
    "collaborators_url": "https://api.github.com/repos/distri/chrapps/collaborators{/collaborator}",
    "teams_url": "https://api.github.com/repos/distri/chrapps/teams",
    "hooks_url": "https://api.github.com/repos/distri/chrapps/hooks",
    "issue_events_url": "https://api.github.com/repos/distri/chrapps/issues/events{/number}",
    "events_url": "https://api.github.com/repos/distri/chrapps/events",
    "assignees_url": "https://api.github.com/repos/distri/chrapps/assignees{/user}",
    "branches_url": "https://api.github.com/repos/distri/chrapps/branches{/branch}",
    "tags_url": "https://api.github.com/repos/distri/chrapps/tags",
    "blobs_url": "https://api.github.com/repos/distri/chrapps/git/blobs{/sha}",
    "git_tags_url": "https://api.github.com/repos/distri/chrapps/git/tags{/sha}",
    "git_refs_url": "https://api.github.com/repos/distri/chrapps/git/refs{/sha}",
    "trees_url": "https://api.github.com/repos/distri/chrapps/git/trees{/sha}",
    "statuses_url": "https://api.github.com/repos/distri/chrapps/statuses/{sha}",
    "languages_url": "https://api.github.com/repos/distri/chrapps/languages",
    "stargazers_url": "https://api.github.com/repos/distri/chrapps/stargazers",
    "contributors_url": "https://api.github.com/repos/distri/chrapps/contributors",
    "subscribers_url": "https://api.github.com/repos/distri/chrapps/subscribers",
    "subscription_url": "https://api.github.com/repos/distri/chrapps/subscription",
    "commits_url": "https://api.github.com/repos/distri/chrapps/commits{/sha}",
    "git_commits_url": "https://api.github.com/repos/distri/chrapps/git/commits{/sha}",
    "comments_url": "https://api.github.com/repos/distri/chrapps/comments{/number}",
    "issue_comment_url": "https://api.github.com/repos/distri/chrapps/issues/comments/{number}",
    "contents_url": "https://api.github.com/repos/distri/chrapps/contents/{+path}",
    "compare_url": "https://api.github.com/repos/distri/chrapps/compare/{base}...{head}",
    "merges_url": "https://api.github.com/repos/distri/chrapps/merges",
    "archive_url": "https://api.github.com/repos/distri/chrapps/{archive_format}{/ref}",
    "downloads_url": "https://api.github.com/repos/distri/chrapps/downloads",
    "issues_url": "https://api.github.com/repos/distri/chrapps/issues{/number}",
    "pulls_url": "https://api.github.com/repos/distri/chrapps/pulls{/number}",
    "milestones_url": "https://api.github.com/repos/distri/chrapps/milestones{/number}",
    "notifications_url": "https://api.github.com/repos/distri/chrapps/notifications{?since,all,participating}",
    "labels_url": "https://api.github.com/repos/distri/chrapps/labels{/name}",
    "releases_url": "https://api.github.com/repos/distri/chrapps/releases{/id}",
    "created_at": "2014-03-11T20:11:10Z",
    "updated_at": "2014-03-11T20:11:10Z",
    "pushed_at": "2014-03-11T20:11:10Z",
    "git_url": "git://github.com/distri/chrapps.git",
    "ssh_url": "git@github.com:distri/chrapps.git",
    "clone_url": "https://github.com/distri/chrapps.git",
    "svn_url": "https://github.com/distri/chrapps",
    "homepage": null,
    "size": 0,
    "stargazers_count": 0,
    "watchers_count": 0,
    "language": null,
    "has_issues": true,
    "has_downloads": true,
    "has_wiki": true,
    "forks_count": 0,
    "mirror_url": null,
    "open_issues_count": 0,
    "forks": 0,
    "open_issues": 0,
    "watchers": 0,
    "default_branch": "master",
    "master_branch": "master",
    "permissions": {
      "admin": true,
      "push": true,
      "pull": true
    },
    "organization": {
      "login": "distri",
      "id": 6005125,
      "avatar_url": "https://gravatar.com/avatar/192f3f168409e79c42107f081139d9f3?d=https%3A%2F%2Fidenticons.github.com%2Ff90c81ffc1498e260c820082f2e7ca5f.png&r=x",
      "gravatar_id": "192f3f168409e79c42107f081139d9f3",
      "url": "https://api.github.com/users/distri",
      "html_url": "https://github.com/distri",
      "followers_url": "https://api.github.com/users/distri/followers",
      "following_url": "https://api.github.com/users/distri/following{/other_user}",
      "gists_url": "https://api.github.com/users/distri/gists{/gist_id}",
      "starred_url": "https://api.github.com/users/distri/starred{/owner}{/repo}",
      "subscriptions_url": "https://api.github.com/users/distri/subscriptions",
      "organizations_url": "https://api.github.com/users/distri/orgs",
      "repos_url": "https://api.github.com/users/distri/repos",
      "events_url": "https://api.github.com/users/distri/events{/privacy}",
      "received_events_url": "https://api.github.com/users/distri/received_events",
      "type": "Organization",
      "site_admin": false
    },
    "network_count": 0,
    "subscribers_count": 2,
    "branch": "v0.1.0-alpha.3",
    "publishBranch": "gh-pages"
  },
  "dependencies": {}
});