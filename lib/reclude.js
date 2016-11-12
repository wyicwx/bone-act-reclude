var esprima = require('esprima');
var estraverse = require('estraverse');
var escodegen = require('escodegen');
var path = require('path');

// 根据路径提取模块名称
function pickModuleNameByPath(modulePath, options) {
    var moduleName = path.relative(options.base, modulePath);

    moduleName = moduleName.replace(path.extname(moduleName), '');
    moduleName = path.normalize(moduleName);
    moduleName = moduleName.split(path.sep).join('/');

    return moduleName;
}

module.exports.act = function(buffer, encoding, callback) {
    var options = this.options({
        lexer: 'reclude',
        lexerReplace: 'require'
    });
    var runtimeBuffer = buffer;
    var runtime = this;
    var bone = runtime.bone;
    var boneFs = runtime.fs;
    var dependList = {};
    if(options.base) {
        options.base = boneFs.pathResolve(options.base, bone.status.base);
    } else {
        options.base = bone.status.base;
    }
    var includePaths = [{
        name: pickModuleNameByPath(runtime.source, options),
        path: runtime.source,
        buffer: buffer
    }];
    var result = [];

    // set cacheable flag
    this.cacheable();
    // 循环
    var transformTree = function() {
        var module = includePaths.shift();

        if(!module) {
            callback(null, result.join(';\n'));
        } else {
            // 解析过后不再解析
            if(dependList[module.path]) {
                return transformTree();
            }
            // 解析过依赖标识
            dependList[module.path] = true;
            // 无buffer，通过bone api读取文件
            if(!module.buffer) {
                boneFs.readFile(module.path, function(error, buffer) {
                    if(error) {
                        bone.log.warn([error, '. File: ', module.path].join(''));
                        callback(null, runtimeBuffer);
                    } else {
                        walkman(buffer, module.path, module.name);
                    }
                });
            } else {
                walkman(module.buffer, module.path, module.name);
            }
        }
    };
    // 遍历节点
    var walkman = function(buffer, modulePath, name) {
        var sourceDir = path.dirname(modulePath);
        try {
            var ast = esprima.parse(buffer.toString(), {
                sourceType: 'module'
            });
        } catch(e) {
            bone.log.warn([e, '. File:', modulePath].join(''));
            return callback(null, runtimeBuffer);
        }

        sourceDir = path.normalize(sourceDir).split(path.sep).join('/');

        estraverse.traverse(ast, {
            enter: function(node) {
                if(node.type == 'CallExpression') {
                    if(node.callee.name == options.lexer) {
                        var args = node.arguments[0];
                        if(args.type == 'Literal') {
                            var modulePath = args.value;

                            node.callee.name = options.lexerReplace;
                            // 解析相对位置到绝对路径
                            modulePath = boneFs.pathResolve(modulePath, sourceDir);

                            var moduleName = pickModuleNameByPath(modulePath, options);

                            args.value = moduleName;

                            includePaths.push({
                                name: moduleName,
                                path: modulePath
                            });
                        }
                    }
                }
            }
        });

        var code = escodegen.generate(ast);

        code = `define('${name}', function(require, exports, module) {\n${code}\n});\n`;

        result.unshift(code);

        transformTree();
    };

    transformTree();
};

module.exports.filter = {
    ext: '.js'
};

module.exports.globalEnable = false;