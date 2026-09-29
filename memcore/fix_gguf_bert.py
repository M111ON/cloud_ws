import sys
sys.path.insert(0, "I:/llama/llama.cpp/gguf-py")
sys.path.insert(0, "I:/llama/llama.cpp/gguf-py/gguf/scripts")
import gguf
from gguf_new_metadata import copy_with_new_metadata, MetadataDetails, get_field_data

inp = sys.argv[1]
out = sys.argv[2]
reader = gguf.GGUFReader(inp, "r")
arch = get_field_data(reader, gguf.Keys.General.ARCHITECTURE)
writer = gguf.GGUFWriter(out, arch=arch, endianess=reader.endianess)
al = get_field_data(reader, gguf.Keys.General.ALIGNMENT)
if al is not None:
    writer.data_alignment = al
copy_with_new_metadata(
    reader, writer,
    {"tokenizer.ggml.token_type_count": MetadataDetails(gguf.GGUFValueType.UINT32, 2)},
    [],  # keep everything else
)
print("wrote", out)
