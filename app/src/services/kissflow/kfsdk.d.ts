// The package ships types that don't resolve through its "exports" map; the adapter uses its own typed facade (sdk.ts).
declare module "@kissflow/lowcode-client-sdk" {
  const sdk: { initialize(): Promise<unknown> };
  export default sdk;
}
