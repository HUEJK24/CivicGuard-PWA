import { HttpError } from '../utils/httpError.js';

/**
 * Validador de entrada declarativo.
 *
 * @example
 * router.post('/', validate({ title: { type: 'string', required: true, max: 120 } }), handler)
 *
 * @param {Record<string, {
 *   type?: 'string' | 'number' | 'boolean',
 *   required?: boolean,
 *   min?: number,
 *   max?: number,
 *   enum?: readonly unknown[],
 *   pattern?: RegExp,
 *   default?: unknown,
 * }>} rules
 */
export function validate(rules) {
  return (req, _res, next) => {
    const errors = [];
    const data = {};
    const body = req.body ?? {};

    for (const [field, rule] of Object.entries(rules)) {
      let value = body[field];

      const isEmpty = value === undefined || value === null || value === '';
      if (isEmpty) {
        if (rule.default !== undefined) {
          data[field] = rule.default;
        } else if (rule.required) {
          errors.push({ field, message: 'es obligatorio' });
        }
        continue;
      }

      if (rule.type === 'number') {
        value = Number(value);
        if (Number.isNaN(value)) {
          errors.push({ field, message: 'debe ser numérico' });
          continue;
        }
      }

      if (rule.type === 'boolean') {
        value = value === true || value === 'true';
      }

      if (rule.type === 'string') {
        value = String(value);
        if (rule.min !== undefined && value.length < rule.min) {
          errors.push({ field, message: `debe tener al menos ${rule.min} caracteres` });
        }
        if (rule.max !== undefined && value.length > rule.max) {
          errors.push({ field, message: `no debe superar ${rule.max} caracteres` });
        }
      }

      if (rule.type === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push({ field, message: `debe ser mayor o igual a ${rule.min}` });
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push({ field, message: `debe ser menor o igual a ${rule.max}` });
        }
      }

      if (rule.enum && !rule.enum.includes(value)) {
        errors.push({ field, message: `debe ser uno de: ${rule.enum.join(', ')}` });
      }

      if (rule.pattern && !rule.pattern.test(String(value))) {
        errors.push({ field, message: 'tiene un formato inválido' });
      }

      data[field] = value;
    }

    if (errors.length > 0) {
      return next(new HttpError(400, 'VALIDATION_ERROR', 'Datos inválidos', errors));
    }

    req.validated = data;
    return next();
  };
}
