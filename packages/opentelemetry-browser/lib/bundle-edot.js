import { diag, DiagConsoleLogger, metrics, trace } from '@opentelemetry/api';
import { diagLogLevelFromString } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { LongTaskInstrumentation } from '@opentelemetry/instrumentation-long-task';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction'
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { resourceFromAttributes } from '@opentelemetry/resources';

import { getContextManager } from './context.js';
import { getResource } from './resource.js';

/**
 * @typedef {Object} WebSdkConfig
 * @property {boolean} [sdkDisabled]
 * @property {string} [logLevel]
 * @property {string} [serviceName]
 * @property {string} [serviceVersion]
 * @property {Record<string, import('@opentelemetry/api').AttributeValue>} [resourceAttributes]
 * // sampler
 * @property {number} [sampleRate]
 * // batch span processor ???
 * @property {number} [bspScheduleDelay]
 * @property {number} [bspexportTimeout]
 * @property {number} [bspMaxQueueSize]
 * @property {number} [bspMaxExportBatchSize]
 * // exporters
 * @property {Record<string, string>} [exporterOtlpHeaders]
 * @property {string} [exporterOtlpEndpoint]
 * @property {string} [exporterOtlpTracesEndpoint]
 */


function startSdk(cfg = {}) {
    /** @type {WebSdkConfig} */
    const defaultConfig = {
        // TODO: check what goes here
        logLevel: 'INFO',
        exporterOtlpEndpoint: 'http://localhost:4318',
    };

    const config = Object.assign(defaultConfig, cfg);
    diag.setLogger(new DiagConsoleLogger(), { logLevel: diagLogLevelFromString(config.logLevel) });
    diag.info(`SDK intialization`, config);
    

    // TODO
    // The web EDOT should have all the necessary components to instrument the app
    // and get rid as much as it can from other optional things.    
    // - should configure for at least the 3 signals (logs, metrics & traces)
    // - should have some locked configs to help tree shaking the code. (eg. the exporter protocol)
    const contextManager = getContextManager();

    /** @type {import('@opentelemetry/resources').DetectedResourceAttributes} */
    const serviceResource = {};
    if (config.serviceName) {
        serviceResource['service.name'] = config.serviceName;
    }
    if (config.serviceVersion) {
        serviceResource['service.version'] = config.serviceVersion;
    }

    // Resource
    const resource = getResource(cfg.resourceAttributes || {})
        .merge(resourceFromAttributes(serviceResource))
        .merge(resourceFromAttributes({
            'telemetry.distro.name': 'elastic',
            // TODO: update this at build time
            'telemetry.distro.version': '0.1.0',
        }));

    // Traces section
    // TODO: validation of config
    if (config.exporterOtlpEndpoint && !config.exporterOtlpTracesEndpoint) {
        config.exporterOtlpTracesEndpoint = `${config.exporterOtlpEndpoint}/v1/traces`;
    }

    const tracerProvider = new WebTracerProvider({
        resource,
        spanProcessors: [
            // TODO: options to enable this? OTLP protocols?
            // new SimpleSpanProcessor(new ConsoleSpanExporter()),
            new BatchSpanProcessor(new OTLPTraceExporter({
                headers: config.exporterOtlpHeaders || {},
                url: config.exporterOtlpTracesEndpoint,
            })),
        ],
    });
    tracerProvider.register({ contextManager });

    // Registering instrumentations
    registerInstrumentations({
        instrumentations: [
            new DocumentLoadInstrumentation(),
            new FetchInstrumentation(),
            new LongTaskInstrumentation(),
            new UserInteractionInstrumentation(),
            new XMLHttpRequestInstrumentation(),
        ],
    });
}


// Set into global scope for user to acces it
globalThis.startSdk = startSdk;
