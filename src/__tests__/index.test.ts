import { create } from "../index";

describe("Module Creation", () => {
  test("should create AirGap module with default options", async () => {
    const module = create();

    expect(module.supportedProtocols).toBeDefined();
    expect(module.supportedProtocols.ada).toBeDefined();
    expect(module.supportedProtocols.ada.type).toBe("full");

    const serializer = await module.createV3SerializerCompanion();
    expect(serializer).toBeDefined();
    expect(serializer.schemas).toBeDefined();
  });

  test("should create AirGap module and support testnet", async () => {
    const module = create();

    expect(module.supportedProtocols).toBeDefined();
    expect(module.supportedProtocols.ada).toBeDefined();
    expect(module.supportedProtocols.ada.type).toBe("full");

    const offlineProtocol = await module.createOfflineProtocol("ada");
    expect(offlineProtocol).toBeDefined();

    const onlineProtocol = await module.createOnlineProtocol(
      "ada",
      "testnet",
    );
    expect(onlineProtocol).toBeDefined();
  });

  test("should return undefined for unsupported protocols", async () => {
    const module = create();

    const unsupportedOffline = await module.createOfflineProtocol(
      "bitcoin" as any,
    );
    expect(unsupportedOffline).toBeUndefined();

    const unsupportedOnline = await module.createOnlineProtocol(
      "ethereum" as any,
    );
    expect(unsupportedOnline).toBeUndefined();
  });
});
