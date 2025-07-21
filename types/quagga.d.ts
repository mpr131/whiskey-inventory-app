declare module '@ericblade/quagga2' {
  export interface QuaggaConfig {
    inputStream?: {
      type?: string;
      target?: HTMLElement;
      constraints?: MediaStreamConstraints;
      area?: {
        top?: string;
        right?: string;
        left?: string;
        bottom?: string;
      };
      size?: number;
    };
    locator?: {
      patchSize?: string;
      halfSample?: boolean;
    };
    decoder?: {
      readers: string[];
      debug?: {
        drawBoundingBox?: boolean;
        drawScanline?: boolean;
        showPattern?: boolean;
      };
    };
    locate?: boolean;
    frequency?: number;
    debug?: boolean;
    numOfWorkers?: number;
    src?: string;
  }

  export interface QuaggaResult {
    codeResult?: {
      code: string;
      format: string;
      decodedCodes: Array<{
        error?: number;
      }>;
    };
  }

  const Quagga: {
    init(config: QuaggaConfig, callback?: (err: any) => void): void;
    start(): void;
    stop(): void;
    onDetected(callback: (result: QuaggaResult) => void): void;
    onProcessed(callback: (result: QuaggaResult) => void): void;
    decodeSingle(config: QuaggaConfig, callback: (result: QuaggaResult) => void): void;
  };

  export default Quagga;
}