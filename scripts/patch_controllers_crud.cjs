const fs = require('fs');

// 1. Patch WorkflowController.java
const wfCtrlPath = 'E:/owner/ownsudo/src/main/java/com/ownsudo/controller/WorkflowController.java';
let wfCtrl = fs.readFileSync(wfCtrlPath, 'utf8');

const targetMethod = `    @GetMapping("/definitions/{id}")
    public ResponseEntity<WorkflowDefinition> getDefinition(@PathVariable String id) {
        return definitionService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }`;

const replacementMethod = `    @GetMapping("/definitions/{id}")
    public ResponseEntity<WorkflowDefinition> getDefinition(@PathVariable String id) {
        return definitionService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/definitions")
    public ResponseEntity<WorkflowDefinition> saveDefinition(@RequestBody WorkflowDefinition def) {
        return ResponseEntity.ok(definitionService.save(def));
    }

    @DeleteMapping("/definitions/{id}")
    public ResponseEntity<Map<String, Object>> deleteDefinition(@PathVariable String id) {
        definitionService.delete(id);
        return ResponseEntity.ok(Map.of("ok", true, "deletedId", id));
    }`;

if (wfCtrl.includes(targetMethod)) {
    wfCtrl = wfCtrl.replace(targetMethod, replacementMethod);
    fs.writeFileSync(wfCtrlPath, wfCtrl, 'utf8');
    console.log('Patched WorkflowController.java with save/delete endpoints');
} else {
    console.log('Target method in WorkflowController.java not found');
}

// 2. Patch AssetController.java
const assetCtrlPath = 'E:/owner/ownsudo/src/main/java/com/ownsudo/controller/AssetController.java';
let assetCtrl = fs.readFileSync(assetCtrlPath, 'utf8');

const targetAsset = `    @PostMapping("/skills")
    public AgentSkill saveSkill(@RequestBody AgentSkill skill) {
        return skillRepository.save(skill);
    }`;

const replacementAsset = `    @PostMapping("/skills")
    public AgentSkill saveSkill(@RequestBody AgentSkill skill) {
        return skillRepository.save(skill);
    }

    @DeleteMapping("/skills/{id}")
    public ResponseEntity<Map<String, Object>> deleteSkill(@PathVariable String id) {
        skillRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("ok", true, "deletedId", id));
    }

    @PostMapping("/tools")
    public McpTool saveTool(@RequestBody McpTool tool) {
        return toolRepository.save(tool);
    }

    @DeleteMapping("/tools/{id}")
    public ResponseEntity<Map<String, Object>> deleteTool(@PathVariable String id) {
        toolRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("ok", true, "deletedId", id));
    }`;

if (assetCtrl.includes(targetAsset)) {
    assetCtrl = assetCtrl.replace(targetAsset, replacementAsset);
    fs.writeFileSync(assetCtrlPath, assetCtrl, 'utf8');
    console.log('Patched AssetController.java with skills and tools CRUD');
} else {
    console.log('Target method in AssetController.java not found');
}
