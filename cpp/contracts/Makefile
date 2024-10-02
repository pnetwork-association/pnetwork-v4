SRC = $(wildcard *.cpp) $(wildcard test/*.cpp)
TARGETS = $(patsubst %.cpp,build/%.wasm,$(SRC))

all: $(TARGETS)

build/%.wasm: %.cpp | build
	cdt-cpp -o $@ $<

build:
	mkdir -p build

clean:
	rm -f ./build/*.abi ./build/*.wasm
