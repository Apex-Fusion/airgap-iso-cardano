import {
  AirGapV3SerializerCompanion,
  SignedTransaction,
  UnsignedTransaction,
  V3SchemaConfiguration,
} from "@airgap/module-kit";

import { SchemaTypes } from "@airgap/serializer/v3/schemas/schema";

import {
  IACMessageType,
  TransactionSignRequest,
  TransactionSignResponse,
} from "@airgap/serializer";


export class CardanoV3SerializerCompanion
  implements AirGapV3SerializerCompanion
{
  public readonly name = 'cardano-v3-serializer'
  public readonly version = '1.0.0'
  public readonly schemas: V3SchemaConfiguration[] = [
    {
      type: IACMessageType.TransactionSignRequest,
      schema: { 
        schema: {
          "$ref": "#/definitions/TransactionSignRequest",
          "$schema": "http://json-schema.org/draft-07/schema#",
          "definitions": {
            "TransactionSignRequest": {
              additionalProperties: false,
              properties: {
                transaction: {},
                publicKey: { type: SchemaTypes.STRING },
                callbackURL: { type: SchemaTypes.STRING }
              } as any,
              required: ["transaction", "publicKey"],
              type: SchemaTypes.OBJECT
            }
          }
        }
      },
      protocolIdentifier: "cardano"
    },
    {
      type: IACMessageType.TransactionSignResponse,
      schema: { 
        schema: {
          "$ref": "#/definitions/TransactionSignResponse",
          "$schema": "http://json-schema.org/draft-07/schema#",
          "definitions": {
            "TransactionSignResponse": {
              additionalProperties: false,
              properties: {
                transaction: { type: SchemaTypes.STRING },
                accountIdentifier: { type: SchemaTypes.STRING }
              } as any,
              required: ["transaction", "accountIdentifier"],
              type: SchemaTypes.OBJECT
            }
          }
        }
      },
      protocolIdentifier: "cardano"
    }
  ];

  async toTransactionSignRequest(
    identifier: string,
    unsignedTransaction: UnsignedTransaction,
    publicKey: string,
    callbackUrl?: string,
  ): Promise<TransactionSignRequest> {
    return {
      transaction: unsignedTransaction,
      publicKey,
      callbackURL: callbackUrl,
    };
  }

  async fromTransactionSignRequest(
    identifier: string,
    transactionSignRequest: TransactionSignRequest,
  ): Promise<UnsignedTransaction> {
    return transactionSignRequest.transaction;
  }

  async validateTransactionSignRequest(
    identifier: string,
    transactionSignRequest: TransactionSignRequest,
  ): Promise<boolean> {
    return (
      transactionSignRequest.transaction != null &&
      typeof transactionSignRequest.publicKey === "string" &&
      transactionSignRequest.publicKey.length > 0
    );
  }

  async toTransactionSignResponse(
    identifier: string,
    signedTransaction: SignedTransaction,
    accountIdentifier: string,
  ): Promise<TransactionSignResponse> {
    return {
      transaction: JSON.stringify(signedTransaction),
      accountIdentifier,
    };
  }

  async fromTransactionSignResponse(
    identifier: string,
    transactionSignResponse: TransactionSignResponse,
  ): Promise<SignedTransaction> {
    // Handle both string and object transaction formats for compatibility
    if (typeof transactionSignResponse.transaction === "string") {
      return JSON.parse(transactionSignResponse.transaction);
    }
    return transactionSignResponse.transaction as SignedTransaction;
  }

  async validateTransactionSignResponse(
    identifier: string,
    transactionSignResponse: TransactionSignResponse,
  ): Promise<boolean> {
    return (
      transactionSignResponse.transaction != null &&
      typeof transactionSignResponse.accountIdentifier === "string"
    );
  }
}
