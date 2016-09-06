var esprima = require('esprima');
var estraverse = require('estraverse');
var escodegen = require('escodegen');
var path = require('path');

// 根据路径提取模块名称
function pickModuleNameByPath(modulePath) {
    var moduleName = path.relative(bone.status.base, modulePath);

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
    var runtime = this;
    var bone = runtime.bone;
    var boneFs = runtime.fs;
    var dependList = {};
    var includePaths = [{
        name: pickModuleNameByPath(runtime.source),
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
            callback(null, result.join('\n;\n'));
        } else {
            // 解析过后不在解析
            if(dependList[module.path]) {
                return transformTree();
            }
            // 解析过依赖标识
            dependList[module.path] = true;
            // 无buffer，通过bone api读取文件
            if(!module.buffer) {
                boneFs.readFile(module.path, function(error, buffer) {
                    if(error) {
                        callback(error);
                    } else {
                        walkman(buffer, module.path, module.name);
                    }
                });
            } else {
                walkman(buffer, module.path, module.name);
            }
        }
    };
    // 遍历节点
    var walkman = function(buffer, modulePath, name) {
        var sourceDir = path.dirname(modulePath);
        var ast = esprima.parse(buffer.toString());

        sourceDir = path.normalize(sourceDir).split(path.sep).join('/');

        estraverse.traverse(ast, {
            enter: function(node) {
                if(node.type == 'CallExpression') {
                    if(node.callee.name == options.lexer) {
                        var args = node.arguments[0];
                        if(args.type == 'Literal') {
                            var modulePath = args.value;

                            node.callee.name = options.lexerReplace;
                            // 取相对位置
                            modulePath = boneFs.pathResolve(modulePath, sourceDir);

                            var moduleName = pickModuleNameByPath(modulePath);

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

        code = `define('${name}', function() {
            ${code}
        })`;

        result.unshift(code);

        transformTree();
    };

    transformTree();
};

module.exports.filter = {
    ext: '.js'
};