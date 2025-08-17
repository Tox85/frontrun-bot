"use strict";
// Système de validation et sanitisation des données d'entrée
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataValidator = void 0;
class DataValidator {
    schemas = new Map();
    /**
     * Enregistrer un schéma de validation
     */
    registerSchema(name, schema) {
        this.schemas.set(name, schema);
    }
    /**
     * Valider des données selon un schéma
     */
    validate(schemaName, data) {
        const schema = this.schemas.get(schemaName);
        if (!schema) {
            return {
                isValid: false,
                errors: [`Schéma de validation '${schemaName}' non trouvé`],
                sanitizedData: data
            };
        }
        const result = {
            isValid: true,
            errors: [],
            sanitizedData: {}
        };
        try {
            result.sanitizedData = this.validateObject(schema, data, result);
        }
        catch (error) {
            result.isValid = false;
            result.errors.push(`Erreur de validation: ${error}`);
        }
        return result;
    }
    /**
     * Valider un objet selon un schéma
     */
    validateObject(schema, data, result, path = '') {
        const sanitized = {};
        for (const [key, rule] of Object.entries(schema)) {
            const currentPath = path ? `${path}.${key}` : key;
            const value = data?.[key];
            if (this.isValidationRule(rule)) {
                const validation = this.validateField(rule, value, currentPath);
                if (!validation.isValid) {
                    result.isValid = false;
                    result.errors.push(...validation.errors);
                }
                sanitized[key] = validation.sanitizedValue;
            }
            else {
                // Règle imbriquée
                if (value && typeof value === 'object') {
                    sanitized[key] = this.validateObject(rule, value, result, currentPath);
                }
                else {
                    sanitized[key] = value;
                }
            }
        }
        return sanitized;
    }
    /**
     * Valider un champ selon une règle
     */
    validateField(rule, value, path) {
        const errors = [];
        let sanitizedValue = value;
        // Vérifier si requis
        if (rule.required && (value === undefined || value === null || value === '')) {
            errors.push(`Le champ '${path}' est requis`);
            return { isValid: false, errors, sanitizedValue };
        }
        // Si pas de valeur et pas requis, ignorer
        if (value === undefined || value === null) {
            return { isValid: true, errors: [], sanitizedValue };
        }
        // Vérifier le type
        if (!this.checkType(rule.type, value)) {
            errors.push(`Le champ '${path}' doit être de type ${rule.type}`);
            return { isValid: false, errors, sanitizedValue };
        }
        // Validations spécifiques au type
        if (rule.type === 'string') {
            const stringValue = String(value);
            if (rule.minLength && stringValue.length < rule.minLength) {
                errors.push(`Le champ '${path}' doit avoir au moins ${rule.minLength} caractères`);
            }
            if (rule.maxLength && stringValue.length > rule.maxLength) {
                errors.push(`Le champ '${path}' doit avoir au maximum ${rule.maxLength} caractères`);
            }
            if (rule.pattern && !rule.pattern.test(stringValue)) {
                errors.push(`Le champ '${path}' ne respecte pas le format requis`);
            }
            sanitizedValue = stringValue;
        }
        if (rule.type === 'number') {
            const numValue = Number(value);
            if (isNaN(numValue)) {
                errors.push(`Le champ '${path}' doit être un nombre valide`);
            }
            else {
                if (rule.min !== undefined && numValue < rule.min) {
                    errors.push(`Le champ '${path}' doit être supérieur ou égal à ${rule.min}`);
                }
                if (rule.max !== undefined && numValue > rule.max) {
                    errors.push(`Le champ '${path}' doit être inférieur ou égal à ${rule.max}`);
                }
                sanitizedValue = numValue;
            }
        }
        if (rule.type === 'array') {
            if (!Array.isArray(value)) {
                errors.push(`Le champ '${path}' doit être un tableau`);
            }
            else {
                if (rule.minLength && value.length < rule.minLength) {
                    errors.push(`Le champ '${path}' doit avoir au moins ${rule.minLength} éléments`);
                }
                if (rule.maxLength && value.length > rule.maxLength) {
                    errors.push(`Le champ '${path}' doit avoir au maximum ${rule.maxLength} éléments`);
                }
            }
        }
        // Validation personnalisée
        if (rule.custom && !rule.custom(value)) {
            errors.push(`Le champ '${path}' ne respecte pas la validation personnalisée`);
        }
        // Sanitisation
        if (rule.sanitize) {
            try {
                sanitizedValue = rule.sanitize(sanitizedValue);
            }
            catch (error) {
                errors.push(`Erreur de sanitisation pour '${path}': ${error}`);
            }
        }
        return {
            isValid: errors.length === 0,
            errors,
            sanitizedValue
        };
    }
    /**
     * Vérifier le type d'une valeur
     */
    checkType(expectedType, value) {
        switch (expectedType) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number' && !isNaN(value);
            case 'boolean':
                return typeof value === 'boolean';
            case 'array':
                return Array.isArray(value);
            case 'object':
                return typeof value === 'object' && value !== null && !Array.isArray(value);
            default:
                return true;
        }
    }
    /**
     * Vérifier si une règle est une ValidationRule
     */
    isValidationRule(rule) {
        return rule && typeof rule === 'object' && 'type' in rule;
    }
    /**
     * Sanitiser une chaîne de caractères (supprimer les caractères dangereux)
     */
    static sanitizeString(value) {
        if (typeof value !== 'string')
            return value;
        return value
            .replace(/[<>]/g, '') // Supprimer < et >
            .replace(/javascript:/gi, '') // Supprimer javascript:
            .replace(/on\w+=/gi, '') // Supprimer les event handlers
            .trim();
    }
    /**
     * Sanitiser une URL
     */
    static sanitizeUrl(value) {
        if (typeof value !== 'string')
            return value;
        // Vérifier que c'est une URL valide
        try {
            const url = new URL(value);
            // Autoriser seulement HTTP et HTTPS
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                throw new Error('Protocole non autorisé');
            }
            return url.toString();
        }
        catch {
            throw new Error('URL invalide');
        }
    }
    /**
     * Sanitiser un objet (supprimer les propriétés dangereuses)
     */
    static sanitizeObject(obj) {
        if (typeof obj !== 'object' || obj === null)
            return obj;
        const sanitized = {};
        const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
        for (const [key, value] of Object.entries(obj)) {
            if (!dangerousKeys.includes(key)) {
                sanitized[key] = this.sanitizeValue(value);
            }
        }
        return sanitized;
    }
    /**
     * Sanitiser une valeur selon son type
     */
    static sanitizeValue(value) {
        if (typeof value === 'string') {
            return this.sanitizeString(value);
        }
        else if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
                return value.map(v => this.sanitizeValue(v));
            }
            else {
                return this.sanitizeObject(value);
            }
        }
        return value;
    }
}
exports.DataValidator = DataValidator;
//# sourceMappingURL=DataValidator.js.map