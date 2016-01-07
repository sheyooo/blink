import { MethodCall } from '../ast/methodcall'
import { Symbol } from './symbol'
import { Types } from '../types/types'
import { TypesUtils } from '../types/typesutils'

export class TypeChecker {

    constructor() {
    }

    static typeCheck(environment, ast) {
        if (ast === undefined) {
            return;
        }

        if (ast.isDefinition()) {
            if (ast.isClass()) {
                this.typeCheckClass(environment, ast);

            } else if (ast.isVariable()) {
                this.typeCheckVariable(environment, ast);

            } else if (ast.isMethod()) {
                this.typeCheckMethod(environment, ast);
            }

        } else if (ast.isExpression()) {
            if (ast.isAssignment()) {
                this.typeCheckAssignment(environment, ast);

            } else if (ast.isBinaryExpression()) {
                this.typeCheckBinaryExpression(environment, ast);

            } else if (ast.isBlock()) {
                this.typeCheckBlock(environment, ast);

            } else if (ast.isBooleanLiteral()) {
                this.typeCheckBooleanLiteral(environment, ast);

            } else if (ast.isConstructorCall()) {
                this.typeCheckConstructorCall(environment, ast);

            } else if (ast.isDecimalLiteral()) {
                this.typeCheckDecimalLiteral(environment, ast);

            } else if (ast.isIfElse()) {
                this.typeCheckIfElse(environment, ast);

            } else if (ast.isInitialization()) {
                this.typeCheckInitialization(environment, ast);

            } else if (ast.isIntegerLiteral()) {
                this.typeCheckIntegerLiteral(environment, ast);

            } else if (ast.isLet()) {
                this.typeCheckLet(environment, ast);

            } else if (ast.isMethodCall()) {
                this.typeCheckMethodCall(environment, ast);

            } else if (ast.isNullLiteral()) {
                this.typeCheckNullLiteral(environment, ast);

            } else if (ast.isReference()) {
                this.typeCheckReference(environment, ast);

            } else if (ast.isStringLiteral()) {
                this.typeCheckStringLiteral(environment, ast);

            } else if (ast.isThis()) {
                this.typeCheckThis(environment, ast);

            } else if (ast.isUnaryExpression()) {
                this.typeCheckUnaryExpression(environment, ast);

            } else if (ast.isWhile()) {
                this.typeCheckWhile(environment, ast);
            }
        }
    }

    static typeCheckIntegerLiteral(environment, integer) {
        integer.expressionType = Types.Int;
    }

    static typeCheckBooleanLiteral(environment, boolean) {
        boolean.expressionType = Types.Bool;
    }

    static typeCheckDecimalLiteral(environment, decimal) {
        decimal.expressionType = Types.Double;
    }

    static typeCheckStringLiteral(environment, string) {
        string.expressionType = Types.String;
    }

    static typeCheckThis(environment, thisExpr) {
        thisExpr.expressionType = environment.currentClass.name;
    }

    static typeCheckAssignment(environment, assign) {
        let symbol = environment.symbolTable.find(assign.identifier);

        if (symbol === undefined) {
            throw new Error(this.error(assign.line, assign.column, `Assignment to an undefined variable '${assign.identifier}'.`));
        }

        this.typeCheck(environment, assign.value);

        let valueType = assign.value.expressionType;

        if (symbol.type === undefined) {
            symbol.type = valueType;

        } else if (!TypesUtils.conform(valueType, symbol.type, environment)) {

            throw new Error(`Value assigned to '${symbol.identifier}' does not conform to the declared type '${symbol.type}'.`);
        }

        assign.expressionType = Types.Unit;
    }

    static typeCheckBinaryExpression(environment, expression) {
        let methodCall = new MethodCall(expression.left, expression.operator, [expression.right]);

        methodCall.line = expression.line;
        methodCall.column = expression.column;

        this.typeCheckMethodCall(environment, methodCall);

        expression.expressionType = methodCall.expressionType;
    }

    static typeCheckBlock(environment, block) {
        environment.symbolTable.enterScope();

        block.expressions.forEach((expression) => {
            this.typeCheck(environment, expression);
        });

        let length = block.expressions.length;

        block.expressionType = length > 0 ? block.expressions[length - 1].expressionType : Types.Unit;

        environment.symbolTable.exitScope();
    }

    static typeCheckClass(environment, klass) {
        let symbolTable = environment.symbolTable;

        let currentClass = environment.currentClass;

        environment.currentClass = klass;

        symbolTable.enterScope();

        klass.parameters.forEach((parameter) => {
            if (symbolTable.check(parameter.identifier)) {
                throw new Error(this.error(parameter.line, parameter.column, `Duplicate class parameter name '${parameter.identifier}' in class '${klass.name}' definition.`));
            }

            symbolTable.add(new Symbol(parameter.identifier, parameter.type, parameter.line, parameter.column));
        });

        klass.variables.forEach((variable) => {
            this.typeCheckVariable(environment, variable);
        });

        klass.methods.forEach((method) => {
            if (environment.hasMethod(klass.name, method)) {
                throw new Error(this.error(method.line, method.column, `Method '${method.name}' with signature '${method.signature()}' is already defined in class '${klass.name}'.`));
            }

            environment.addMethod(klass.name, method);

            this.typeCheckMethod(environment, method);
        });

        symbolTable.exitScope();

        environment.currentClass = currentClass;
    }

    static typeCheckConstructorCall(environment, call) {
        if (!environment.hasClass(call.type)) {
            throw new Error(this.error(call.line, call.column, `Undefined type '${call.type}'.`));
        }

        let klass = environment.getClass(call.type);

        let parametersCount = klass.parameters.length;

        if (parametersCount !== call.args.length) {
            throw new Error(this.error(call.line, call.column, `Constructor of class '${klass.name}' called with wrong number of arguments.`));
        }

        for (let i = 0; i < parametersCount; ++i) {
            let arg = call.args[i];

            this.typeCheck(environment, arg);

            let argType = arg.expressionType;
            let parameterType = klass.parameters[i].type;

            if (!TypesUtils.conform(argType, parameterType, environment)) {
                throw new Error(this.error(arg.line, arg.column, `Constructor argument type '${argType}' does not conform to declared type '${parameterType}'.`));
            }
        }

        call.expressionType = call.type;
    }

    static typeCheckIfElse(environment, ifElse) {
        this.typeCheck(environment, ifElse.condition);

        if (ifElse.condition.expressionType !== Types.Bool) {
            throw new Error(this.error(ifElse.condition.line, ifElse.condition.column, `Condition of the if/else expression evaluates to a value of type '${ifElse.condition.expressionType}', must evaluate to a boolean value.`));
        }

        this.typeCheck(environment, ifElse.thenBranch);

        if (ifElse.elseBranch === undefined) {
            ifElse.expressionType = Types.Unit;

        } else {
            this.typeCheck(environment, ifElse.elseBranch);

            ifElse.expressionType = TypesUtils.leastUpperBound(ifElse.thenBranch.expressionType, ifElse.elseBranch.expressionType, environment);
        }
    }

    static typeCheckInitialization(environment, init) {
        let symbolTable = environment.symbolTable;

        if (symbolTable.check(init.identifier)) {
            throw new Error(this.error(init.line, init.column, `Duplicate identifier '${init.identifier}' in let binding.`));
        }

        let symbol = new Symbol(init.identifier, init.type, init.line, init.column);

        if (init.value === undefined) {
            init.expressionType = init.type;

        } else {
            this.typeCheck(environment, init.value);

            let valueType = init.value.expressionType;

            if (init.type === undefined) {
                init.type = valueType;

            } else {
                if (!TypesUtils.conform(valueType, init.type, environment)) {
                    throw new Error(this.error(init.line, init.column, `Assigned value to variable '${init.identifier}' of type '${valueType}'does not conform to its declared type '${init.type}'.`));
                }
            }

            init.expressionType = valueType;
        }

        symbol.type = init.expressionType;

        symbolTable.add(symbol);
    }

    static typeCheckLet(environment, letExpr) {
        environment.symbolTable.enterScope();

        letExpr.initializations.forEach((init) => {
            this.typeCheckInitialization(environment, init);
        });

        this.typeCheck(environment, letExpr.body);

        letExpr.expressionType = letExpr.body.expressionType;

        environment.symbolTable.exitScope();
    }

    static typeCheckMethod(environment, method) {
        let symbolTable = environment.symbolTable;

        if (method.override) {
            let overrided = TypesUtils.findOverridedMethod(environment.currentClass.superClass, method, environment);

            if (overrided === undefined) {
                throw new Error(this.error(method.line, method.column, `No suitable method '${method.name}' found in superclass(es) to override.`));
            }
        }

        symbolTable.enterScope();

        method.parameters.forEach((parameter) => {
            if (symbolTable.check(parameter.identifier)) {
                throw new Error(this.error(parameter.line, parameter.column, `Duplicate parameter name '${parameter.identifier}' in method '${method.name}'.`));
            }

            symbolTable.add(new Symbol(parameter.identifier, parameter.type, parameter.line, parameter.column));
        });

        this.typeCheck(environment, method.body);

        if (!TypesUtils.conform(method.body.expressionType, method.returnType, environment)) {
            throw new Error(this.error(method.line, method.column, `Method '${method.name}' value type '${method.body.expressionType}' does not conform to return type '${method.returnType}'.`));
        }

        symbolTable.exitScope();
    }

    static typeCheckMethodCall(environment, call) {
        if (call.object !== undefined) {
            this.typeCheck(environment, call.object);
        }

        let objectClass = call.object === undefined ? environment.currentClass
            : environment.getClass(call.object.expressionType);

        if (!TypesUtils.hasMethodWithName(objectClass, call.methodName, environment)) {
            throw new Error(this.error(call.line, call.column, `No method '${call.methodName}' defined in class '${objectClass.name}'.`));
        }

        call.args.forEach((arg) => {
            this.typeCheck(environment, arg);
        });

        let argsTypes = call.args.map((arg) => arg.expressionType);

        let method = TypesUtils.findMethodToApply(objectClass, call.methodName, argsTypes, environment);

        if (method === undefined) {
            throw new Error(this.error(call.line, call.column, `Method '${call.methodName}' of class '${objectClass.name}' cannot be applied to '(${argsTypes.join(",")})'.`));
        }

        call.expressionType = method.returnType;
    }

    static typeCheckNullLiteral(environment, nullExpr) {
        nullExpr.expressionType = Types.Null;
    }

    static typeCheckProgram(environment, program) {
        let currentClass = environment.currentClass;

        program.classes.forEach((klass) => {
            if (environment.hasClass(klass.name)) {
                throw new Error(`Class '${klass.name}' at ${klass.line + 1}:${klass.column + 1} is already defined.`);
            }

            environment.addClass(klass);

            environment.currentClass = klass;

            TypeChecker.typeCheck(environment, klass);
        });

        environment.currentClass = currentClass;
    }

    static typeCheckReference(environment, reference) {
        let symbol = environment.symbolTable.find(reference.identifier);

        if (symbol !== undefined) {
            reference.expressionType = symbol.type;

        } else if (environment.currentClass.hasVariable(reference.identifier)) {
            reference.expressionType = environment.currentClass
                .getVariable(reference.identifier)
                .type;

        } else {
            throw new Error(this.error(reference.line, reference.column, `Reference to an undefined identifier '${reference.identifier}'.`));
        }
    }

    static typeCheckUnaryExpression(environment, expression) {
        let methodCall = new MethodCall(expression.expression, 'unary_' + expression.operator, []);

        methodCall.line = expression.line;
        methodCall.column = expression.column;

        this.typeCheckMethodCall(environment, methodCall);

        expression.expressionType = methodCall.expressionType;
    }

    static typeCheckVariable(environment, variable) {
        let symbolTable = environment.symbolTable;

        if (symbolTable.check(variable.name)) {
            throw new Error(this.error(variable.line, variable.column, `An instance variable named '${variable.name}' is already in scope.`));
        }

        if (variable.value !== undefined) {
            this.typeCheck(environment, variable.value);

            if (variable.type === undefined) {
                variable.type = variable.value.expressionType;

            } else {
                if (!TypesUtils.conform(variable.value.expressionType, variable.type, environment)) {
                    throw new Error(this.error(variable.line, variable.column, `Value of type '${variable.value.expressionType}' cannot be assigned to variable '${variable.name}' of type '${variable.type}'.`));
                }
            }
        }

        symbolTable.add(new Symbol(variable.name, variable.type, variable.line, variable.column));
    }

    static typeCheckWhile(environment, whileExpr) {
        this.typeCheck(environment, whileExpr.condition);

        if (whileExpr.condition.expressionType !== Types.Bool) {
            throw new Error(this.error(whileExpr.condition.line, whileExpr.condition.column, `Condition of a while loop evaluates to a value of type '${whileExpr.condition.expressionType}', must evaluate to a boolean value.`));
        }

        this.typeCheck(environment, whileExpr.body);

        whileExpr.expressionType = Types.Unit;
    }

    static error(line, column, message) {
        if (line === undefined || column === undefined) {
            return message;
        }

        return `${line + 1}:${column + 1}: ${message}`;
    }
}