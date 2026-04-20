#import <Capacitor/Capacitor.h>

CAP_PLUGIN(LinkaBiometricPlugin, "LinkaBiometric",
    CAP_PLUGIN_METHOD(isAvailable,      CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(verifyIdentity,   CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setCredentials,   CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getCredentials,   CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(deleteCredentials, CAPPluginReturnPromise);
)
