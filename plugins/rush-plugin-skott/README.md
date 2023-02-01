### rush-plugin-skott

[skott](https://github.com/antoine-coulon/skott) is a minimalist library thats generates directed graphs from projects.

This **rush-plugin-skott** exposes multiple commands leveraging the power of [skott](https://github.com/antoine-coulon/skott):

#### `rush graph`

This command generates a graph of your Rush monorepo projects and opens a webui to visualize it.

![rush-graph](https://user-images.githubusercontent.com/43391199/215892215-eee3b70a-4186-4669-b02c-18b0f376234e.png)

#### `rush list-unused-packages` 

This command traverses each of the Rush monorepo projects and search for unused `npm` packages in production code.

![rush-list-unused](https://user-images.githubusercontent.com/43391199/216106483-4d6be883-1d2d-4bb0-a1ca-bc2c04884af6.png)
