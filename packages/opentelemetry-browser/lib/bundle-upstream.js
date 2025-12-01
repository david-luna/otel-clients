// file: telemetry.js
import { diag, DiagConsoleLogger, trace, metrics, context } from '@opentelemetry/api';
import { diagLogLevelFromString } from '@opentelemetry/core';
import { resourceFromAttributes, detectResources } from '@opentelemetry/resources';
import { browserDetector } from '@opentelemetry/opentelemetry-browser-detector';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { logs } from '@opentelemetry/api-logs';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { LongTaskInstrumentation } from '@opentelemetry/instrumentation-long-task';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';

const initDone = Symbol('OTEL initialized');
// Expected properties of the config object
// - logLevel
// - resourceAttributes
// - endpoint
// - exportHeaders
function initOpenTelemetry(config) {
    // to avoid multiple calls
    if (window[initDone]) {
        return;
    }
    window[initDone] = true;
    diag.setLogger(
        new DiagConsoleLogger(),
        { logLevel: diagLogLevelFromString(config.logLevel) },
    );
    diag.info('OTEL bootstrap', config);

    // Resource definition
    const detectedResources = detectResources({ detectors: [browserDetector] });
    const resource = resourceFromAttributes(config.resourceAttributes)
        .merge(detectedResources);

    // Trace signal setup
    const tracesEndpoint = `${config.endpoint}/v1/traces`;
    const tracerProvider = new WebTracerProvider({
        resource,
        spanProcessors: [
            new BatchSpanProcessor(new OTLPTraceExporter({
                headers: config.exportHeaders || {},
                url: tracesEndpoint,
            })),
        ],
    });
    tracerProvider.register({ contextManager: new ZoneContextManager() });

    // Metrics signal setup
    const metricsEndpoint = `${config.endpoint}/v1/metrics`;
    const metricReader = new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
            headers: config.exportHeaders || {},
            url: metricsEndpoint
        }),
    });
    const meterProvider = new MeterProvider({
        resource: resource,
        readers: [metricReader],
    });
    metrics.setGlobalMeterProvider(meterProvider);

    // Logs signal setup
    const logsEndpoint = `${config.endpoint}/v1/logs`;
    const logExporter = new OTLPLogExporter({
        headers: config.exportHeaders || {},
        url: logsEndpoint
    });

    const loggerProvider = new LoggerProvider({
        resource: resource,
        processors: [new BatchLogRecordProcessor(logExporter)]
    });
    logs.setGlobalLoggerProvider(loggerProvider);

    // Register instrumentations
    registerInstrumentations({
        instrumentations: [
            new DocumentLoadInstrumentation(),
            new LongTaskInstrumentation(),
            new FetchInstrumentation({
                propagateTraceHeaderCorsUrls: /localhost/
            }),
            new XMLHttpRequestInstrumentation(),
            new UserInteractionInstrumentation(),
        ],
    });
}

globalThis.initOpenTelemetry = initOpenTelemetry;
