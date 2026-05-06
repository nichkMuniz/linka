#import <Capacitor/Capacitor.h>

CAP_PLUGIN(GpsTrackingPlugin, "GpsTrackingPlugin",
    CAP_PLUGIN_METHOD(start, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stop,  CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(addListener, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(removeAllListeners, CAPPluginReturnPromise);
)
