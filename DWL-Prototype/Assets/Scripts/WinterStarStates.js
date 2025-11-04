// WinterStarStates.js
// Manages the overall state flow for the Winter Star experience


// @input SceneObject starObject
// @input SceneObject fragment1
// @input SceneObject fragment2
// @input SceneObject fragment3
// @input SceneObject iceSculpture1
// @input SceneObject iceSculpture2
// @input SceneObject iceSculpture3
// @input SceneObject christmasTree
// @input bool debugMode = true




script.api.f1 = function ()
{
    script.iceSculpture1.enabled = false;
    print('fragment 1 collected');
}

script.api.f2 = function ()
{
    script.iceSculpture2.enabled = false;
    print('fragment 2 collected');
}

script.api.f3 = function ()
{
    script.iceSculpture3.enabled = false;
    print('fragment 3 collected');
    script.christmasTree.enabled = true;
}




