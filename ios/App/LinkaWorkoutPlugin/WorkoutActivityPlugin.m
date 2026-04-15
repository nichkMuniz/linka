#import <Capacitor/Capacitor.h>

CAP_PLUGIN(WorkoutActivityPlugin, "WorkoutActivityPlugin",
    CAP_PLUGIN_METHOD(start,  CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(update, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stop,   CAPPluginReturnPromise);
)
