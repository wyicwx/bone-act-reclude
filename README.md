# bone-act-reclude
> include & require cmd module plugin for bone

### 安装及使用

通过npm安装

```sh
$ npm install bone-act-reclude 
```

安装后在`bonefile.js`文件内通过`act()`加载

```js
var bone = require('bone');
var reclude = bone.require('bone-act-reclude');

bone.dest('dist')
    .src('~/src/react.jsx')
    .act(reclude({
        base: 'src',
        lexer: 'reclude',
        lexerReplace: 'require'
    }));
```

src/app.js 
```js
var moduleA = reclude('./page/foo.js');
```

src/page/foo.js
```js
console.log('bar');
```

处理后
```js
define('page/foo', function(require, exports, module) {
    console.log('bar');
});
define('app', function(require, exports, module) {
    var moduleA = require('./page/foo.js');
});
```
### filter

默认设置只针对源文件后缀为`.js`文件进行处理

### 其他

处理器开发以及使用请参考[处理器](https://github.com/wyicwx/bone/blob/master/docs/plugin.md)