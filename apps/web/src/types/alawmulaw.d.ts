declare module "alawmulaw" {
  export const mulaw: {
    encode: (samples: Int16Array) => Uint8Array;
    decode: (samples: Uint8Array) => Int16Array;
  };
}
