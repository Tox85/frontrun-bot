export interface ValidationRule {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    enum?: any[];
    custom?: (value: any) => boolean;
    sanitize?: (value: any) => any;
}
export interface ValidationSchema {
    [key: string]: ValidationRule | ValidationSchema;
}
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    sanitizedData: any;
}
export declare class DataValidator {
    private schemas;
    /**
     * Enregistrer un schéma de validation
     */
    registerSchema(name: string, schema: ValidationSchema): void;
    /**
     * Valider des données selon un schéma
     */
    validate(schemaName: string, data: any): ValidationResult;
    /**
     * Valider un objet selon un schéma
     */
    private validateObject;
    /**
     * Valider un champ selon une règle
     */
    private validateField;
    /**
     * Vérifier le type d'une valeur
     */
    private checkType;
    /**
     * Vérifier si une règle est une ValidationRule
     */
    private isValidationRule;
    /**
     * Sanitiser une chaîne de caractères (supprimer les caractères dangereux)
     */
    static sanitizeString(value: string): string;
    /**
     * Sanitiser une URL
     */
    static sanitizeUrl(value: string): string;
    /**
     * Sanitiser un objet (supprimer les propriétés dangereuses)
     */
    static sanitizeObject(obj: any): any;
    /**
     * Sanitiser une valeur selon son type
     */
    static sanitizeValue(value: any): any;
}
