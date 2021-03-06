
// For Windows, we distribute a prebuilt bsc.exe
// To build on windows, we still need figure out constructing config.ml
// from existing  compiler

// For other OSes, we detect
// if there is other compiler installed and the version matches,
// we get the config.ml from existing OCaml compiler and build `whole_compiler`

// Otherwise, we build the compiler shipped with Buckle and use the
// old compiler.ml

var child_process = require('child_process')
var process = require('process')
var fs = require('fs')
var path = require('path')
var os = require('os')

var jscomp = __dirname
var working_dir = process.cwd()
console.log("Working dir", working_dir)


delete process.env.OCAMLPARAM // stdlib is already compiled using -bin-annot
process.env.OCAMLRUNPARAM = 'b'
if (is_windows) {
    process.env.WIN32 = '1'
}

// need check which variables exist when we update compiler
var map = {
    LIBDIR : "standard_library_default",
    BYTERUN : "standard_runtime",
    CCOMPTYPE : "ccomp_type",
    BYTECC : "bytecomp_c_compiler",
    BYTECCLIBS : "bytecomp_c_libraries",
    NATIVECC : "native_c_compiler",
    NATIVECCLIBS : "native_c_libraries",
    PACKLD : "native_pack_linker",
    RANLIBCMD : "ranlib",
    ARCMD : "ar",
    CC_PROFILE : "cc_profile",

    MKDLL : "mkdll", // undefined
    MKEXE : "mkexe", // undefined
    MKMAINDLL : "mkmaindll", // undefined TODO: upstream to print it too

    ARCH : "architecture",
    MODEL : "model",
    SYSTEM : "system",
    ASM : "asm",
    ASM_CFI_SUPPORTED : "asm_cfi_supported", // boolean
    WITH_FRAME_POINTERS : "with_frame_pointers", // boolean
    EXT_OBJ : "ext_obj",
    EXT_ASM : "ext_asm",
    EXT_LIB : "ext_lib",
    EXT_DLL : "ext_lib",
    HOST : "host",
    TARGET : "target",
    SYSTHREAD_SUPPORT : "systhread_supported" // boolean
}

var is_windows = ! (os.type().indexOf('Windows') < 0)

/* This will not work on Windows
   Windows diestribution relies on env variable OCAMLLIB and CAMLLIB
   delete process.env.OCAMLLIB
   delete process.env.CAMLLIB
*/


/*
 * @return false if it does not exist otherwise the map
*/
function getConfigOutput(){
    try{
        var ocamlc_config ;
        if(is_windows){
            ocamlc_config = "ocamlc.opt.exe -config"
        } else {
            ocamlc_config = "ocamlc.opt -config"
        }
        var config_output = child_process.execSync(ocamlc_config, {encoding: 'utf8'})
        console.log("config_output:\n", config_output);
        var keyvalues =
            config_output
            .split('\n')
            .filter(function(x){return x})
            .map(function(x){
                var index = x.indexOf(":")
                var key = x.substr(0,index);
                var value = x.substr(index+1);
                return [key.trim(), value.trim()]
            }
            )
        console.log("keyvalues",keyvalues)
        return keyvalues.reduce(function(acc,curr){
            acc[curr[0]] = curr[1]
            return acc
        },{})

    }
    catch(e){
        console.error("configuration failure")
        return false
    }
}


function patch_config(config_map){
    var whole_compiler_config = path.join(jscomp, 'bin', 'config_whole_compiler.mlp')
    var whole_compiler_config_output = path.join(jscomp, 'bin', 'config_whole_compiler.ml')
    var content = fs.readFileSync(whole_compiler_config, 'utf8')
    var generated = content.replace(/%%(\w+)%%/g,
        function (_whole, p0) {
            if (p0 === "LIBDIR") {
                //Escape
		if(is_windows){
		    return 'Filename.concat (Filename.concat (Filename.concat (Filename.dirname Sys.executable_name) "..") "lib") "ocaml"'
		}
		else{
                    var origin_path = path.join(jscomp, '..', 'lib', 'ocaml')
                    return JSON.stringify(origin_path);
			// .slice(1, -1)
		}
            }
            else {
                return config_map[map[p0]]
            }
        })

    fs.writeFileSync(whole_compiler_config_output, generated, 'utf8')
}


var config_map = getConfigOutput()
if(config_map && config_map.version.indexOf('4.02.3') >= 0){
  patch_config(config_map);
}else{
  process.exit(2)
}
