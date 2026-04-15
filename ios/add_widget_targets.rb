#!/usr/bin/env ruby
# add_widget_targets.rb
#
# Adds two targets to the Xcode project:
#   1. LinkaWorkoutWidget  — Widget Extension (Live Activity UI)
#   2. LinkaWorkoutPlugin  — Capacitor native plugin (WorkoutActivityPlugin)
#
# Usage (on macOS with xcodeproj gem):
#   gem install xcodeproj
#   ruby ios/add_widget_targets.rb
#
# Idempotent: re-running after the targets already exist is a no-op.

require 'xcodeproj'
require 'fileutils'

PROJECT_PATH   = File.expand_path('App/App.xcodeproj', __dir__)
APP_BUNDLE_ID  = 'com.linka.meuapp'
SWIFT_VERSION  = '5.0'
DEPLOY_TARGET  = '16.1'   # ActivityKit minimum
APP_DEPLOY     = '15.0'   # main app keeps its target

puts "Opening #{PROJECT_PATH} ..."
project = Xcodeproj::Project.open(PROJECT_PATH)

# ──────────────────────────────────────────────────────────────────────────────
# Helper: find-or-create a group at a given path relative to the project root
# ──────────────────────────────────────────────────────────────────────────────
def find_or_create_group(project, folder_name, disk_path)
  existing = project.main_group.children.find { |g| g.respond_to?(:path) && g.path == folder_name }
  return existing if existing

  group = project.main_group.new_group(folder_name, disk_path)
  group
end

# ──────────────────────────────────────────────────────────────────────────────
# 1. LinkaWorkoutWidget  (Widget Extension)
# ──────────────────────────────────────────────────────────────────────────────
WIDGET_TARGET_NAME = 'LinkaWorkoutWidget'
WIDGET_BUNDLE_ID   = "#{APP_BUNDLE_ID}.LinkaWorkoutWidget"
WIDGET_FOLDER      = File.expand_path('App/LinkaWorkoutWidget', __dir__)

unless project.targets.map(&:name).include?(WIDGET_TARGET_NAME)
  puts "Adding target: #{WIDGET_TARGET_NAME}"

  widget_target = project.new_target(
    :app_extension,
    WIDGET_TARGET_NAME,
    :ios,
    DEPLOY_TARGET,
    project.products_group,
    :swift
  )

  # Source files
  widget_group = find_or_create_group(project, WIDGET_TARGET_NAME, WIDGET_FOLDER)
  swift_files  = Dir.glob("#{WIDGET_FOLDER}/*.swift").map { |f| File.basename(f) }

  swift_files.each do |filename|
    file_ref = widget_group.new_file(filename)
    widget_target.source_build_phase.add_file_reference(file_ref)
  end

  # Build settings – Debug
  widget_target.build_configuration_list.set_setting('PRODUCT_BUNDLE_IDENTIFIER',  WIDGET_BUNDLE_ID)
  widget_target.build_configuration_list.set_setting('SWIFT_VERSION',               SWIFT_VERSION)
  widget_target.build_configuration_list.set_setting('IPHONEOS_DEPLOYMENT_TARGET',  DEPLOY_TARGET)
  widget_target.build_configuration_list.set_setting('TARGETED_DEVICE_FAMILY',      '1,2')
  widget_target.build_configuration_list.set_setting('CODE_SIGN_STYLE',             'Automatic')
  widget_target.build_configuration_list.set_setting('INFOPLIST_FILE',              "#{WIDGET_TARGET_NAME}/Info.plist")
  widget_target.build_configuration_list.set_setting('SKIP_INSTALL',               'YES')

  # Embed the extension inside the main App target
  app_target = project.targets.find { |t| t.name == 'App' }
  if app_target
    embed_phase = app_target.build_phases.find { |p| p.is_a?(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase) && p.name == 'Embed Foundation Extensions' }
    unless embed_phase
      embed_phase = project.new(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase)
      embed_phase.name = 'Embed Foundation Extensions'
      embed_phase.dst_subfolder_spec = '13'   # PlugIns folder
      app_target.build_phases << embed_phase
    end

    widget_product_ref = widget_target.product_reference
    build_file = project.new(Xcodeproj::Project::Object::PBXBuildFile)
    build_file.file_ref = widget_product_ref
    build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
    embed_phase.files << build_file

    # Also add as dependency
    dep = project.new(Xcodeproj::Project::Object::PBXTargetDependency)
    dep.target = widget_target
    app_target.dependencies << dep
  end

  puts "  → #{WIDGET_TARGET_NAME} added (#{swift_files.count} Swift files)"
else
  puts "  → #{WIDGET_TARGET_NAME} already exists, skipping."
end

# ──────────────────────────────────────────────────────────────────────────────
# 2. LinkaWorkoutPlugin  (Capacitor native plugin — compiled into the App target)
#
# Unlike the widget, the plugin files are compiled INTO the main App target,
# not as a separate target. This matches how Capacitor plugins work.
# ──────────────────────────────────────────────────────────────────────────────
PLUGIN_FOLDER = File.expand_path('App/LinkaWorkoutPlugin', __dir__)
PLUGIN_GROUP_NAME = 'LinkaWorkoutPlugin'

app_target   = project.targets.find { |t| t.name == 'App' }
plugin_group = project.main_group.children.find { |g| g.respond_to?(:path) && g.path == PLUGIN_GROUP_NAME }

if plugin_group.nil?
  puts "Adding plugin sources group: #{PLUGIN_GROUP_NAME}"

  plugin_group = find_or_create_group(project, PLUGIN_GROUP_NAME, PLUGIN_FOLDER)

  Dir.glob("#{PLUGIN_FOLDER}/*.{swift,m,h}").map { |f| File.basename(f) }.each do |filename|
    file_ref = plugin_group.new_file(filename)
    app_target.source_build_phase.add_file_reference(file_ref)
  end

  puts "  → Plugin sources added to App target"
else
  puts "  → #{PLUGIN_GROUP_NAME} group already exists, skipping."
end

# ──────────────────────────────────────────────────────────────────────────────
# 3. Create a minimal Info.plist for the Widget Extension if it doesn't exist
# ──────────────────────────────────────────────────────────────────────────────
widget_plist_path = "#{WIDGET_FOLDER}/Info.plist"
unless File.exist?(widget_plist_path)
  puts "Creating #{widget_plist_path}"
  File.write(widget_plist_path, <<~PLIST)
    <?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    <plist version="1.0">
    <dict>
      <key>NSExtension</key>
      <dict>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.widgetkit-extension</string>
      </dict>
    </dict>
    </plist>
  PLIST
end

# ──────────────────────────────────────────────────────────────────────────────
# Save
# ──────────────────────────────────────────────────────────────────────────────
project.save
puts "\nDone! project.pbxproj updated."
