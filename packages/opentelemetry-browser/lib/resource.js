import { resourceFromAttributes, defaultResource } from '@opentelemetry/resources';

/**
 * @param {Record<string, import('@opentelemetry/api').AttributeValue>} attribs
 * @returns {import('@opentelemetry/resources').Resource}
 */
export function getResource(attribs) {
    return defaultResource()
        .merge(resourceFromAttributes(attribs))
        .merge(resourceFromAttributes({
            ['user_agent.original']: navigator.userAgent,
            //https://developer.mozilla.org/en-US/docs/Web/HTTP/Browser_detection_using_the_user_agent#mobile_tablet_or_desktop
            ['bowser.mobile']: navigator.userAgent.includes('Mobi'),
            ['browser.touch_screen_enabled']: navigator.maxTouchPoints > 0,
            ['browser.language']: navigator.language,
            // others use ua-parser but is quite a big chunk of code
            // [ATTR_BROWSER_NAME]: browserName,
            // [ATTR_BROWSER_VERSION]: browserVersion,
            // [ATTR_DEVICE_TYPE]: deviceType,
            ['network.effective_type']: navigator['networkInformation']?.effectiveType || 'unknown',
            ['screen.width']: window.screen.width,
            ['screen.height']: window.screen.height,
            ['screen.size']: computeScreenSize(window.screen.width),
        }));
}

/**
 * @param {number} screenWidth 
 * @returns {'small' | 'medium' | 'large' | 'unknown'}
 */
function computeScreenSize (screenWidth) {
    if (screenWidth <= 768) return 'small';
    else if (screenWidth > 768 && screenWidth <= 1024) return 'medium';
    else if (screenWidth > 1024) return 'large';

    return 'unknown';
};
