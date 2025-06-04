/**
 * Tests for the new validation system
 */

import { Validators, CardanoValidationError } from "../utils/validation";
import { ResultUtils } from "../utils/result";

describe("Validation System", () => {
  describe("Result Type", () => {
    test("should create successful results", () => {
      const result = ResultUtils.ok("test");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("test");
      }
    });

    test("should create error results", () => {
      const error = new Error("test error");
      const result = ResultUtils.error(error);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(error);
      }
    });

    test("should map successful results", () => {
      const result = ResultUtils.ok(5);
      const mapped = ResultUtils.map(result, (x) => x * 2);
      expect(mapped.success).toBe(true);
      if (mapped.success) {
        expect(mapped.data).toBe(10);
      }
    });
  });

  describe("Basic Validators", () => {
    test("should validate strings", () => {
      const validator = Validators.string({ minLength: 3, maxLength: 10 });

      const validResult = validator.validate("hello");
      expect(validResult.success).toBe(true);

      const tooShortResult = validator.validate("hi");
      expect(tooShortResult.success).toBe(false);

      const tooLongResult = validator.validate("this is too long");
      expect(tooLongResult.success).toBe(false);

      const notStringResult = validator.validate(123);
      expect(notStringResult.success).toBe(false);
    });

    test("should validate numbers", () => {
      const validator = Validators.number({ min: 0, max: 100, integer: true });

      const validResult = validator.validate(50);
      expect(validResult.success).toBe(true);

      const tooSmallResult = validator.validate(-1);
      expect(tooSmallResult.success).toBe(false);

      const tooLargeResult = validator.validate(101);
      expect(tooLargeResult.success).toBe(false);

      const notIntegerResult = validator.validate(50.5);
      expect(notIntegerResult.success).toBe(false);
    });

    test("should validate hex strings", () => {
      const validator = Validators.hexString({ length: 8 });

      const validResult = validator.validate("abcd1234");
      expect(validResult.success).toBe(true);

      const invalidCharsResult = validator.validate("ghij1234");
      expect(invalidCharsResult.success).toBe(false);

      const wrongLengthResult = validator.validate("abc123");
      expect(wrongLengthResult.success).toBe(false);
    });
  });

  describe("Error Handling", () => {
    test("should create detailed validation errors", () => {
      const error = new CardanoValidationError(
        "testField",
        "invalidValue",
        "must be valid",
      );

      expect(error.field).toBe("testField");
      expect(error.value).toBe("invalidValue");
      expect(error.constraint).toBe("must be valid");
      expect(error.message).toContain("testField");
      expect(error.message).toContain("must be valid");
    });
  });
});
