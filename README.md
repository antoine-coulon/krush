## Krush, the set of plugins that will make you love Rush

Here is an exhaustive list of all the `krush` plugins available:

### - [rush-plugin-skott](https://github.com/antoine-coulon/krush/tree/master/plugins/rush-plugin-skott)

[skott](https://github.com/antoine-coulon/skott) is a minimalist library thats generates directed graphs from projects.

This **rush-plugin-skott** exposes multiple commands leveraging the power of [skott](https://github.com/antoine-coulon/skott):

#### `rush graph`

This command generates a graph of your Rush monorepo projects and opens a webui to visualize it.

![skott-rush](https://user-images.githubusercontent.com/43391199/215892215-eee3b70a-4186-4669-b02c-18b0f376234e.png)

#### `rush list-unused-packages` (WIP)

This command traverses each of the Rush monorepo projects and search for unused `npm` packages in production code.

## Install

To install `krush` plugins and enable plugin commands in your monorepo please follow this guide https://rushjs.io/pages/maintainer/using_rush_plugins/

Here is an example of a `common/config/rush/rush-plugins.json` using `rush-plugin-skott`

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/rush/v5/rush-plugins.schema.json",
  "plugins": [
    {
        "packageName": "rush-plugin-skott",
        "pluginName": "rush-skott",
        "autoinstallerName": "rush-plugins"
    }
  ]
}
```

