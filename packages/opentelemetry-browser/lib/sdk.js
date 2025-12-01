import { diag } from '@opentelemetry/api';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { getContextManager } from './context.js';
import { getInstrumentations } from './instrumentations.js';
import { getSampler, getSpanProcessors } from './trace.js';
import { getResource } from './resource.js';
import { createLogger } from './logger.js';

/**
 * @typedef {Object} BrowserSdkConfiguration
 * @property {boolean} [disabled]
 * @property {string} [serviceName]
 * @property {string} [serviceVersion]
 * @property {string} [logLevel] // default from the env var spec
 * @property {import('@opentelemetry/api').ContextManager} [contextManager]
 * @property {Record<string, import('@opentelemetry/api').AttributeValue>} [resourceAttributes]
 * @property {import('@opentelemetry/resources').ResourceDetector[]} [resourceDetectors]
 * @property {import('@opentelemetry/sdk-trace-base').Sampler} [sampler]
 * @property {import('./trace.js').SamplerConfig} [samplerConfig] // loses over sampler and based on env var spec
 * @property {import('@opentelemetry/sdk-trace-base').SpanProcessor[]} [spanProcessors]
 * @property {import('@opentelemetry/instrumentation').Instrumentation[]} [instrumentations]
 * @property {string} [otlpEndpoint] // defaults to the value in env var spec
 * @property {string} [otlpTracesEndpoint] // defaults to the value in env var spec
 * @property {Record<string, string>} [exportHeaders] // defaults to {}
 * 
 * // other options
 * @property {import('@opentelemetry/sdk-trace-base').Sampler | { type: string, arg: number }} [sampler] // defaults to {}
 * 
 * // nice to have
 * @property {string} [opampEndpoint] // TODO: that would be nice huh?
 */

/**
 * @param {BrowserSdkConfiguration} [cfg]
 * @returns {{ shutdown: () => Promise<void> }}
 */
export function startBrowserSdk(cfg = {}) {
    diag.setLogger(createLogger({ logLevel: cfg.logLevel, fields: { name: 'elastic-otel-browser' }}));
    diag.debug(`SDK intialization`, cfg);

    // Context
    const contextManager = cfg.contextManager || getContextManager();

    // Resource
    /** @type {import('@opentelemetry/resources').DetectedResourceAttributes} */
    const serviceResource = {};
    if (cfg.serviceName) {
        serviceResource['service.name'] = cfg.serviceName;
    }
    if (cfg.serviceVersion) {
        serviceResource['service.version'] = cfg.serviceVersion;
    }
    
    const resource = getResource(cfg.resourceAttributes || {})
        .merge(resourceFromAttributes(serviceResource))
        .merge(resourceFromAttributes({
            'telemetry.distro.name': 'elastic',
            // TODO: update this at build time
            'telemetry.distro.version': '0.1.0',
        }));

    // Trace signal
    const sampler = cfg.sampler || getSampler(cfg.samplerConfig);
    const spanProcessors = cfg.spanProcessors || getSpanProcessors(cfg);
    const tracerProvider = new WebTracerProvider({ resource, sampler, spanProcessors });
    // TODO: WebTracerProvider comes with a composite propagator [W3C, Baggage].
    // Should we allow users to pass their own propagator?
    tracerProvider.register({ contextManager });

    // Instrumentations
    // TODO:
    // - add some smart defaults on config?
    // - add other options in that match classic RUM agent?
    const instrumentations = cfg.instrumentations || getInstrumentations();
    registerInstrumentations({ instrumentations });

    return {
        shutdown: async () => {
            Promise.all([
                tracerProvider.shutdown()
            ]).then(() => {})
        },
    }
}