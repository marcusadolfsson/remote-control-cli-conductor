//! The server and the plugin ship in one release: they carry one version.

#[test]
fn the_server_and_the_plugin_have_one_version() {
    let plugin = include_str!("../../../plugin/.claude-plugin/plugin.json");
    let version = plugin
        .lines()
        .find_map(|line| line.trim().strip_prefix("\"version\": \""))
        .and_then(|rest| rest.split('"').next())
        .expect("plugin.json has a version");
    assert_eq!(
        env!("CARGO_PKG_VERSION"),
        version,
        "set plugin/.claude-plugin/plugin.json's version to the workspace's"
    );
}
