import { CardanoV3SerializerCompanion } from "../serializer/cardano-v3-serializer";
import { UnsignedTransaction, SignedTransaction } from "@airgap/module-kit";

describe("CardanoV3SerializerCompanion", () => {
  let serializer: CardanoV3SerializerCompanion;

  beforeEach(() => {
    serializer = new CardanoV3SerializerCompanion();
  });

  test("should create transaction sign request", async () => {
    const unsignedTx: UnsignedTransaction = { type: "unsigned" } as any;
    const publicKey = "test-public-key";
    const callbackUrl = "https://example.com/callback";

    const request = await serializer.toTransactionSignRequest(
      "cardano",
      unsignedTx,
      publicKey,
      callbackUrl,
    );

    expect(request.transaction).toBe(unsignedTx);
    expect(request.publicKey).toBe(publicKey);
    expect(request.callbackURL).toBe(callbackUrl);
  });

  test("should extract transaction from sign request", async () => {
    const unsignedTx: UnsignedTransaction = { type: "unsigned" } as any;
    const request = {
      transaction: unsignedTx,
      publicKey: "test-key",
    };

    const extracted = await serializer.fromTransactionSignRequest(
      "cardano",
      request as any,
    );
    expect(extracted).toBe(unsignedTx);
  });

  test("should validate transaction sign request", async () => {
    const validRequest = {
      transaction: { type: "unsigned" },
      publicKey: "test-key",
    };

    const isValid = await serializer.validateTransactionSignRequest(
      "cardano",
      validRequest as any,
    );
    expect(isValid).toBe(true);

    const invalidRequest = {
      transaction: null,
      publicKey: 123,
    };

    const isInvalid = await serializer.validateTransactionSignRequest(
      "cardano",
      invalidRequest as any,
    );
    expect(isInvalid).toBe(false);
  });

  test("should create transaction sign response", async () => {
    const signedTx: SignedTransaction = { type: "signed" } as any;
    const accountId = "test-account";

    const response = await serializer.toTransactionSignResponse(
      "cardano",
      signedTx,
      accountId,
    );

    expect(response.transaction).toBe(JSON.stringify(signedTx));
    expect(response.accountIdentifier).toBe(accountId);
  });

  test("should extract transaction from sign response", async () => {
    const signedTx: SignedTransaction = { type: "signed" } as any;
    const response = {
      transaction: JSON.stringify(signedTx),
      accountIdentifier: "test-account",
    };

    const extracted = await serializer.fromTransactionSignResponse(
      "cardano",
      response,
    );
    expect(extracted).toEqual(signedTx);
  });

  test("should validate transaction sign response", async () => {
    const validResponse = {
      transaction: '{"type":"signed"}',
      accountIdentifier: "test-account",
    };

    const isValid = await serializer.validateTransactionSignResponse(
      "cardano",
      validResponse,
    );
    expect(isValid).toBe(true);

    const invalidResponse = {
      transaction: null,
      accountIdentifier: 123,
    };

    const isInvalid = await serializer.validateTransactionSignResponse(
      "cardano",
      invalidResponse as any,
    );
    expect(isInvalid).toBe(false);
  });
});
