Output docs/demo.gif

Set FontSize 18
Set Width 1200
Set Height 700
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms

Type "npm run build"
Enter
Sleep 2s

Type "node packages/cli/dist/index.js generate examples/petstore.yaml -o examples/petstore.mcpforge.json"
Enter
Sleep 2s

Type "node packages/cli/dist/index.js inspect --manifest examples/petstore.mcpforge.json"
Enter
Sleep 3s

Ctrl+C
